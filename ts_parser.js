const fs = require('fs');
const path = require('path');
const ts = require('typescript');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node ts_parser.js <file_path> <repo_root_path>");
  process.exit(1);
}

const filePath = path.resolve(args[0]);
const repoRoot = path.resolve(args[1]);
const relativeFilePath = path.relative(repoRoot, filePath);

function getLineAndCharacter(sourceFile, pos) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
  return { line: line + 1, character: character + 1 }; // 1-based
}

function getJSDoc(node, sourceFile) {
  const jsDocComments = ts.getJSDocCommentsAndTags(node);
  if (jsDocComments && jsDocComments.length > 0) {
    // Just return the text of the first doc comment block
    const comment = jsDocComments[0];
    return comment.getText(sourceFile);
  }
  
  // Try retrieving comments manually if the utility returns nothing
  const nodeText = sourceFile.text;
  const ranges = ts.getLeadingCommentRanges(nodeText, node.pos);
  if (ranges) {
    for (const range of ranges) {
      if (range.kind === ts.SyntaxKind.MultiLineCommentTrivia && nodeText.slice(range.pos, range.pos + 3) === '/**') {
        return nodeText.slice(range.pos, range.end);
      }
    }
  }
  return "";
}

function parseFile(file, relativePath) {
  let sourceText;
  try {
    sourceText = fs.readFileSync(file, 'utf8');
  } catch (err) {
    console.error(JSON.stringify({ error: `Failed to read file: ${err.message}` }));
    process.exit(1);
  }

  let sourceFile;
  try {
    sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
  } catch (err) {
    console.error(JSON.stringify({ error: `Syntax error or parser failure: ${err.message}` }));
    process.exit(1);
  }

  const chunks = [];

  function getSignatureText(node) {
    // Construct a signature representation
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) {
      const name = node.name ? node.name.getText(sourceFile) : "anonymous";
      const params = node.parameters.map(p => p.getText(sourceFile)).join(', ');
      const retType = node.type ? `: ${node.type.getText(sourceFile)}` : '';
      return `${name}(${params})${retType}`;
    }
    if (ts.isClassDeclaration(node)) {
      const name = node.name ? node.name.getText(sourceFile) : "anonymous";
      const heritage = node.heritageClauses ? " " + node.heritageClauses.map(h => h.getText(sourceFile)).join(' ') : "";
      return `class ${name}${heritage}`;
    }
    return node.getText(sourceFile).split('\n')[0];
  }

  function visit(node, parentName = "") {
    // 1. Class declarations
    if (ts.isClassDeclaration(node)) {
      const className = node.name ? node.name.getText(sourceFile) : "AnonymousClass";
      const startLoc = getLineAndCharacter(sourceFile, node.getStart(sourceFile));
      const endLoc = getLineAndCharacter(sourceFile, node.getEnd());
      
      const methods = [];
      const properties = [];
      node.members.forEach(member => {
        if (ts.isMethodDeclaration(member)) {
          methods.push(member.name.getText(sourceFile));
        } else if (ts.isPropertyDeclaration(member)) {
          properties.push(member.name.getText(sourceFile));
        }
      });

      const qName = parentName ? `${parentName}.${className}` : className;
      chunks.push({
        id: `${relativePath}::${qName}`,
        type: "class",
        name: className,
        qualified_name: qName,
        file_path: relativePath,
        line_start: startLoc.line,
        line_end: endLoc.line,
        signature: getSignatureText(node),
        docstring: getJSDoc(node, sourceFile),
        source_code: node.getText(sourceFile),
        metadata: {
          methods: methods,
          properties: properties
        }
      });

      // Walk members for methods
      node.members.forEach(member => {
        if (ts.isMethodDeclaration(member)) {
          const methodName = member.name.getText(sourceFile);
          const methodStart = getLineAndCharacter(sourceFile, member.getStart(sourceFile));
          const methodEnd = getLineAndCharacter(sourceFile, member.getEnd());
          const methodQName = `${qName}.${methodName}`;
          
          const params = member.parameters.map(p => ({
            name: p.name.getText(sourceFile),
            type: p.type ? p.type.getText(sourceFile) : "any",
            default: p.initializer ? p.initializer.getText(sourceFile) : null
          }));

          chunks.push({
            id: `${relativePath}::${methodQName}`,
            type: "function",
            name: methodName,
            qualified_name: methodQName,
            file_path: relativePath,
            line_start: methodStart.line,
            line_end: methodEnd.line,
            signature: getSignatureText(member),
            docstring: getJSDoc(member, sourceFile),
            source_code: member.getText(sourceFile),
            metadata: {
              parameters: params,
              return_type: member.type ? member.type.getText(sourceFile) : "any"
            }
          });
        }
      });
    }

    // 2. Standalone Functions
    else if (ts.isFunctionDeclaration(node)) {
      const funcName = node.name ? node.name.getText(sourceFile) : "anonymous";
      const startLoc = getLineAndCharacter(sourceFile, node.getStart(sourceFile));
      const endLoc = getLineAndCharacter(sourceFile, node.getEnd());
      const qName = parentName ? `${parentName}.${funcName}` : funcName;

      const params = node.parameters.map(p => ({
        name: p.name.getText(sourceFile),
        type: p.type ? p.type.getText(sourceFile) : "any",
        default: p.initializer ? p.initializer.getText(sourceFile) : null
      }));

      chunks.push({
        id: `${relativePath}::${qName}`,
        type: "function",
        name: funcName,
        qualified_name: qName,
        file_path: relativePath,
        line_start: startLoc.line,
        line_end: endLoc.line,
        signature: getSignatureText(node),
        docstring: getJSDoc(node, sourceFile),
        source_code: node.getText(sourceFile),
        metadata: {
          parameters: params,
          return_type: node.type ? node.type.getText(sourceFile) : "any"
        }
      });
    }

    // 3. Arrow functions declared in variables
    else if (ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach(decl => {
        if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
          const varName = decl.name.getText(sourceFile);
          const startLoc = getLineAndCharacter(sourceFile, node.getStart(sourceFile));
          const endLoc = getLineAndCharacter(sourceFile, node.getEnd());
          const qName = parentName ? `${parentName}.${varName}` : varName;

          const params = decl.initializer.parameters.map(p => ({
            name: p.name.getText(sourceFile),
            type: p.type ? p.type.getText(sourceFile) : "any",
            default: p.initializer ? p.initializer.getText(sourceFile) : null
          }));

          chunks.push({
            id: `${relativePath}::${qName}`,
            type: "function",
            name: varName,
            qualified_name: qName,
            file_path: relativePath,
            line_start: startLoc.line,
            line_end: endLoc.line,
            signature: `${varName}(${params.map(p => p.name).join(', ')})`,
            docstring: getJSDoc(node, sourceFile),
            source_code: node.getText(sourceFile),
            metadata: {
              parameters: params,
              return_type: decl.initializer.type ? decl.initializer.type.getText(sourceFile) : "any"
            }
          });
        }
        
        // 4. Configuration Schemas (Zod objects or named schema)
        else if (decl.name && (decl.name.getText(sourceFile).toLowerCase().includes('schema') || 
                 (decl.initializer && decl.initializer.getText(sourceFile).includes('z.object')))) {
          const schemaName = decl.name.getText(sourceFile);
          const startLoc = getLineAndCharacter(sourceFile, node.getStart(sourceFile));
          const endLoc = getLineAndCharacter(sourceFile, node.getEnd());
          const qName = parentName ? `${parentName}.${schemaName}` : schemaName;

          chunks.push({
            id: `${relativePath}::${qName}`,
            type: "config_schema",
            name: schemaName,
            qualified_name: qName,
            file_path: relativePath,
            line_start: startLoc.line,
            line_end: endLoc.line,
            signature: `const ${schemaName} = ...`,
            docstring: getJSDoc(node, sourceFile),
            source_code: node.getText(sourceFile),
            metadata: {
              schema_type: decl.initializer ? decl.initializer.getText(sourceFile).split('(')[0] : "zod"
            }
          });
        }
      });
    }

    // 5. API Endpoints (Express patterns e.g., app.get('/...', ...))
    else if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
      const call = node.expression;
      const propAccess = call.expression;
      if (ts.isPropertyAccessExpression(propAccess)) {
        const objName = propAccess.expression.getText(sourceFile);
        const methodName = propAccess.name.getText(sourceFile);
        
        // Express router methods
        const httpMethods = ["get", "post", "put", "delete", "patch"];
        if (httpMethods.includes(methodName.toLowerCase()) && call.arguments.length > 0) {
          const firstArg = call.arguments[0];
          if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
            const routePath = firstArg.text;
            const startLoc = getLineAndCharacter(sourceFile, node.getStart(sourceFile));
            const endLoc = getLineAndCharacter(sourceFile, node.getEnd());
            
            const endpointName = `${methodName.toUpperCase()} ${routePath}`;
            // Stable identifier format
            const qName = `endpoint:${methodName.toUpperCase()}_${routePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
            
            chunks.push({
              id: `${relativePath}::${qName}`,
              type: "api_endpoint",
              name: endpointName,
              qualified_name: qName,
              file_path: relativePath,
              line_start: startLoc.line,
              line_end: endLoc.line,
              signature: `${methodName.toUpperCase()} ${routePath}`,
              docstring: getJSDoc(node, sourceFile) || "",
              source_code: node.getText(sourceFile),
              metadata: {
                route: routePath,
                method: methodName.toUpperCase()
              }
            });
          }
        }
        
        // Commander CLI Commands: program.command('...')
        if (methodName === "command" && (objName === "program" || objName === "cli") && call.arguments.length > 0) {
          const firstArg = call.arguments[0];
          if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
            const commandStr = firstArg.text;
            const startLoc = getLineAndCharacter(sourceFile, node.getStart(sourceFile));
            const endLoc = getLineAndCharacter(sourceFile, node.getEnd());
            
            const commandName = commandStr.split(' ')[0];
            const qName = `cli_command:${commandName}`;
            
            chunks.push({
              id: `${relativePath}::${qName}`,
              type: "cli_command",
              name: commandName,
              qualified_name: qName,
              file_path: relativePath,
              line_start: startLoc.line,
              line_end: endLoc.line,
              signature: `command: ${commandStr}`,
              docstring: getJSDoc(node, sourceFile) || "",
              source_code: node.getText(sourceFile),
              metadata: {
                command: commandStr
              }
            });
          }
        }
      }
    }

    ts.forEachChild(node, child => visit(child, parentName));
  }

  visit(sourceFile);
  return chunks;
}

try {
  const result = parseFile(filePath, relativeFilePath);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error(JSON.stringify({ error: e.message, stack: e.stack }));
  process.exit(1);
}
