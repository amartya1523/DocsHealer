import os
import json
import time
import hashlib
from typing import List, Dict, Any, Optional
from openai import OpenAI
from docs_healer.logger import logger

class EmbeddingEngine:
    def __init__(self, api_key: str, model: str = "text-embedding-3-small", cache_dir: str = ".self-healing-docs"):
        self.client = OpenAI(api_key=api_key) if api_key else None
        self.model = model
        self.cache_dir = cache_dir
        self.cache_file = os.path.join(cache_dir, "embedding_cache.json")
        self.cache: Dict[str, List[float]] = {}
        
        # Load cache if exists
        self._load_cache()

    def _load_cache(self):
        if os.path.exists(self.cache_file):
            try:
                os.makedirs(self.cache_dir, exist_ok=True)
                with open(self.cache_file, "r", encoding="utf-8") as f:
                    self.cache = json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load embedding cache: {str(e)}", phase="indexing")
                self.cache = {}

    def save_cache(self):
        try:
            os.makedirs(self.cache_dir, exist_ok=True)
            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump(self.cache, f)
        except Exception as e:
            logger.warning(f"Failed to save embedding cache: {str(e)}", phase="indexing")

    def _get_text_hash(self, text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def get_embedding(self, text: str) -> List[float]:
        """Get embedding for a single text, using cache if available."""
        h = self._get_text_hash(text)
        if h in self.cache:
            return self.cache[h]

        if not self.client:
            raise ValueError("OpenAI client not initialized. OPENAI_API_KEY environment variable is missing.")

        embeddings = self.get_embeddings_batch([text])
        if embeddings:
            self.cache[h] = embeddings[0]
            self.save_cache()
            return embeddings[0]
        else:
            raise Exception("Failed to generate embedding.")

    def get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings for a list of texts using batching and retries."""
        if not texts:
            return []

        # Find cached items and map indices
        results: List[Optional[List[float]]] = [None] * len(texts)
        uncached_texts: List[str] = []
        uncached_indices: List[int] = []

        for idx, text in enumerate(texts):
            h = self._get_text_hash(text)
            if h in self.cache:
                results[idx] = self.cache[h]
            else:
                uncached_texts.append(text)
                uncached_indices.append(idx)

        if not uncached_texts:
            return results  # All were cached!

        if not self.client:
            raise ValueError("OpenAI client not initialized. OPENAI_API_KEY environment variable is missing.")

        # Batch API requests
        batch_size = 100
        for i in range(0, len(uncached_texts), batch_size):
            batch = uncached_texts[i:i+batch_size]
            batch_indices = uncached_indices[i:i+batch_size]
            
            # API call with exponential backoff retries
            retries = 5
            backoff_factor = 2
            success = False
            response = None
            
            for attempt in range(retries):
                try:
                    logger.track_api_call()
                    response = self.client.embeddings.create(
                        input=batch,
                        model=self.model
                    )
                    success = True
                    break
                except Exception as e:
                    # Check if it's a rate limit error (often contains 'rate_limit' or code 429)
                    err_msg = str(e).lower()
                    is_rate_limit = "rate_limit" in err_msg or "429" in err_msg
                    
                    if is_rate_limit:
                        logger.track_rate_limit()
                        sleep_time = backoff_factor ** attempt
                        logger.warning(
                            f"Rate limit error during embeddings API call. Retrying in {sleep_time}s (Attempt {attempt+1}/{retries})...",
                            phase="indexing",
                            extra={"error": str(e)}
                        )
                        time.sleep(sleep_time)
                    else:
                        logger.error(
                            f"Fatal API error during embeddings call on attempt {attempt+1}/{retries}",
                            phase="indexing",
                            exception=e
                        )
                        if attempt == retries - 1:
                            raise e
                        time.sleep(1)

            if not success or not response:
                raise Exception("Failed to call OpenAI Embeddings API after multiple retries.")

            # Store results in cache and final array
            for res_idx, data in zip(batch_indices, response.data):
                vector = data.embedding
                text_hash = self._get_text_hash(texts[res_idx])
                self.cache[text_hash] = vector
                results[res_idx] = vector

        self.save_cache()
        return results

    def compute_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Compute cosine similarity between two numeric vectors."""
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        norm_a = sum(a * a for a in vec1) ** 0.5
        norm_b = sum(b * b for b in vec2) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot_product / (norm_a * norm_b)
