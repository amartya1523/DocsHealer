import json
import sys
import time
import traceback
from typing import Any, Dict, Optional

class JsonLogger:
    def __init__(self):
        self.api_call_count = 0
        self.rate_limit_encounters = 0

    def log(self, level: str, message: str, phase: Optional[str] = None, extra: Optional[Dict[str, Any]] = None):
        log_entry = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "level": level.upper(),
            "message": message
        }
        if phase:
            log_entry["phase"] = phase
        if extra:
            log_entry.update(extra)

        # Include cost-tracking API metrics
        log_entry["api_call_count"] = self.api_call_count
        log_entry["rate_limit_encounters"] = self.rate_limit_encounters

        sys.stdout.write(json.dumps(log_entry) + "\n")
        sys.stdout.flush()

    def info(self, message: str, phase: Optional[str] = None, extra: Optional[Dict[str, Any]] = None):
        self.log("info", message, phase, extra)

    def warning(self, message: str, phase: Optional[str] = None, extra: Optional[Dict[str, Any]] = None):
        self.log("warning", message, phase, extra)

    def error(self, message: str, phase: Optional[str] = None, exception: Optional[Exception] = None, extra: Optional[Dict[str, Any]] = None):
        if extra is None:
            extra = {}
        if exception:
            extra["error_message"] = str(exception)
            extra["stack_trace"] = "".join(traceback.format_exception(type(exception), exception, exception.__traceback__))
        self.log("error", message, phase, extra)

    def track_api_call(self):
        self.api_call_count += 1

    def track_rate_limit(self):
        self.rate_limit_encounters += 1

# Global logger instance
logger = JsonLogger()
