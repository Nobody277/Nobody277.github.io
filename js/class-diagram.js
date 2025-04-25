class ClassDiagramGenerator {
    constructor(options = {}) {
        this.config = {
            showMethods: true,
            showAttributes: true,
            showRelationships: true,
            showAccessModifiers: true,
            ...options
        };

        this.classes = [];
        this.relationships = [];
    }

    findMatchingBrace(code, startIndex) {
        if (startIndex < 0 || startIndex >= code.length || code[startIndex] !== '{') {
             // console.warn("findMatchingBrace called without starting '{' at index:", startIndex);
            return -1;
        }
        let braceLevel = 1;
        for (let i = startIndex + 1; i < code.length; i++) {
            if (code[i] === '{') {
                braceLevel++;
            } else if (code[i] === '}') {
                braceLevel--;
                if (braceLevel === 0) {
                    return i;
                }
            }
            // Basic skip for comments/strings - assumes comments are already removed mostly
            else if (code[i] === '/' && code[i+1] === '/') {
                 i = code.indexOf('\n', i);
                 if (i === -1) break;
            } else if (code[i] === '/' && code[i+1] === '*') {
                 i = code.indexOf('*/', i + 2);
                 if (i === -1) break;
                 i++;
            } else if (code[i] === '"') {
                i++;
                while(i < code.length && (code[i] !== '"' || code[i-1] === '\\')) {
                    i++;
                }
            } else if (code[i] === "'") {
                 i++;
                while(i < code.length && (code[i] !== "'" || code[i-1] === '\\')) {
                    i++;
                }
            }
        }
         // console.warn("No matching brace found for index:", startIndex);
        return -1;
    }


    parseCode(code) {
        console.log('Parsing code for class diagram (v3 - Refined Regex)...');

        const parsedClassData = {
             name: null,
             extendsClass: null,
             implementsInterfaces: [],
             fields: [],
             methods: []
        };
        const codeBlockSpans = []; // Stores { start, end } indices relative to classBody

        try {
            let cleanCode = this.removeComments(code);

            const classSignatureRegex = /(?:^|\n|\s)(?:public|private|protected)?\s*(?:abstract|final)?\s*class\s+([A-Za-z0-9_]+)(\s+extends\s+([A-Za-z0-9_<>,\s]+))?(\s+implements\s+([A-Za-z0-9_<>,\s]+))?/;
            const classMatch = cleanCode.match(classSignatureRegex);

            if (!classMatch) {
                 if (cleanCode.match(/interface\s+[A-Za-z0-9_]+/)) {
                     console.log("Skipping interface definition.");
                     return { success: true, message: 'Skipped interface.', classData: null };
                 }
                 if (cleanCode.match(/enum\s+[A-Za-z0-9_]+/)) {
                     console.log("Skipping enum definition.");
                     return { success: true, message: 'Skipped enum.', classData: null };
                 }
                 // Try finding the class keyword anyway, maybe the regex failed
                 const simpleClassMatch = cleanCode.match(/class\s+([A-Za-z0-9_]+)/);
                 if (simpleClassMatch) {
                     console.warn("Complex class signature regex failed, using simple match for name:", simpleClassMatch[1]);
                      parsedClassData.name = simpleClassMatch[1];
                      // Attempt to find body still
                 } else {
                    throw new Error('No class definition found');
                 }
            } else {
                 parsedClassData.name = classMatch[1];
                 parsedClassData.extendsClass = classMatch[3] ? classMatch[3].trim() : null;
                 parsedClassData.implementsInterfaces = classMatch[5] ? classMatch[5].split(',').map(i => i.trim()) : [];
            }

            const className = parsedClassData.name;
            if (!className) {
                 throw new Error('Failed to extract class name.');
            }

            // Find class body start index more reliably
            const classDeclarationEndIndex = classMatch ? classMatch.index + classMatch[0].length : cleanCode.indexOf(className) + className.length;
            const classBodyStartIndex = cleanCode.indexOf('{', classDeclarationEndIndex);

            if (classBodyStartIndex === -1) {
                 throw new Error(`Could not find opening brace '{' for class body of ${className}`);
            }
            const classBodyEndIndex = this.findMatchingBrace(cleanCode, classBodyStartIndex);
             if (classBodyEndIndex === -1) {
                 throw new Error(`Could not find closing brace '}' for class body of ${className}`);
             }
            // Extract only the content *inside* the main class braces
            const classBody = cleanCode.substring(classBodyStartIndex + 1, classBodyEndIndex);


            // --- Block Identification Pass ---
            let blockMatch;
            let methodIndex = 0;
            const controlFlowKeywords = new Set(['if', 'for', 'while', 'switch', 'catch', 'try', 'synchronized']);

            // 1. Identify Constructors
            // Regex: Optional access mod, ClassName, (params), optional throws, {
            const constructorRegex = new RegExp(`(?:^|\\n|\\r)\\s*(private|public|protected)?\\s*${className}\\s*\\(([^)]*)\\)\\s*(?:throws\\s+[A-Za-z0-9_,\\s]+)?\\s*\\{`, 'g');
            while ((blockMatch = constructorRegex.exec(classBody)) !== null) {
                 const signatureEndIndex = blockMatch.index + blockMatch[0].length - 1; // Index of the '{'
                 const bodyEndIndexInClassBody = this.findMatchingBrace(classBody, signatureEndIndex);

                 if (bodyEndIndexInClassBody !== -1) {
                     codeBlockSpans.push({ start: blockMatch.index, end: bodyEndIndexInClassBody });

                     const paramsString = blockMatch[2] || '';
                     const params = paramsString.split(',').map(param => {
                         param = param.trim();
                         if (!param) return null;
                         const parts = param.split(/\s+/);
                         const name = parts[parts.length - 1];
                         const dataType = parts.slice(0, -1).join(' ');
                         return { dataType: dataType || 'Unknown', name: name };
                     }).filter(p => p !== null);

                     parsedClassData.methods.push({
                         id: methodIndex++,
                         accessModifier: blockMatch[1] || 'package-private',
                         nonAccessModifier: '', // Constructors don't have static/final/abstract in the same way
                         returnType: 'constructor',
                         name: className,
                         parameters: params,
                         isConstructor: true
                     });
                 } else {
                      console.warn(`Could not find matching brace for constructor starting near index ${signatureEndIndex} in class body.`);
                 }
            }


            // 2. Identify Methods
            // Regex: Optional access, optional mods (static/final/abstract...), return type (must exist), method name (identifier), (params), optional throws, {
            // Return type: Allows generics <>, arrays [], dots .
            // Method name: Standard identifier
            const methodRegex = /(?:^|\n|\r)\s*(private|public|protected)?((?:\s+(?:static|final|abstract|synchronized|native))*)\s+([A-Za-z0-9_<>\[\].]+(?:\s*\[\s*\])*)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*(?:throws\s+[A-Za-z0-9_,\s]+)?\s*\{/g;
             while ((blockMatch = methodRegex.exec(classBody)) !== null) {
                 const methodName = blockMatch[4];

                 // Skip if the method name is a control flow keyword
                 if (controlFlowKeywords.has(methodName)) {
                     // console.log(`Skipping potential control flow match: ${methodName}`);
                     continue;
                 }
                 // Skip if it looks like an anonymous class instantiation or lambda
                 if (methodName === 'new' || !blockMatch[3]) { // Check if return type exists
                      // console.log(`Skipping potential anonymous class/lambda or invalid match: ${blockMatch[0]}`);
                      continue;
                 }


                 const signatureEndIndex = blockMatch.index + blockMatch[0].length - 1; // Index of the '{'
                 const bodyEndIndexInClassBody = this.findMatchingBrace(classBody, signatureEndIndex);

                 if (bodyEndIndexInClassBody !== -1) {
                     // Check if this block overlaps/contains a previously found block (e.g. method inside method - shouldn't happen in valid Java)
                     let isOverlapping = false;
                     for(const span of codeBlockSpans) {
                         if (blockMatch.index < span.end && signatureEndIndex > span.start) {
                              // console.warn(`Detected overlapping block for method ${methodName}, skipping.`);
                              isOverlapping = true;
                              break;
                         }
                     }
                     if (isOverlapping) continue;


                     codeBlockSpans.push({ start: blockMatch.index, end: bodyEndIndexInClassBody });

                     const paramsString = blockMatch[5] || '';
                     const params = paramsString.split(',').map(param => {
                         param = param.trim();
                         if (!param) return null;
                         const parts = param.split(/\s+/);
                         const name = parts[parts.length - 1];
                         const dataType = parts.slice(0, -1).join(' ');
                         return { dataType: dataType || 'Unknown', name: name };
                     }).filter(p => p !== null);

                     parsedClassData.methods.push({
                         id: methodIndex++,
                         accessModifier: blockMatch[1] || 'package-private',
                         nonAccessModifier: (blockMatch[2] || '').trim(),
                         returnType: blockMatch[3].trim(),
                         name: methodName,
                         parameters: params,
                         isConstructor: false
                     });
                 } else {
                      console.warn(`Could not find matching brace for method ${methodName} starting near index ${signatureEndIndex} in class body.`);
                 }
            }


            // 3. Identify Static Initializer Blocks
            const staticBlockRegex = /(?:^|\n|\r)\s*static\s*\{/g;
             while ((blockMatch = staticBlockRegex.exec(classBody)) !== null) {
                 const bodyStartIndexInClassBody = blockMatch.index + blockMatch[0].length - 1; // Index of the '{'
                 const bodyEndIndexInClassBody = this.findMatchingBrace(classBody, bodyStartIndexInClassBody);

                 if (bodyEndIndexInClassBody !== -1) {
                     codeBlockSpans.push({ start: blockMatch.index, end: bodyEndIndexInClassBody });
                 } else {
                      console.warn(`Could not find matching brace for static block starting near index ${bodyStartIndexInClassBody} in class body.`);
                 }
            }

            // Sort spans by start index just in case
            codeBlockSpans.sort((a, b) => a.start - b.start);

            // --- Field Identification Pass ---
            // Regex: Optional access, optional mods, type, name, optional assignment, ; (anchored to start of line relative to classBody)
            const fieldRegex = /^[ \t]*(private|public|protected)?((?:\s+(?:static|final|transient|volatile))*)\s+([A-Za-z0-9_<>\[\].]+(?:\s*\[\s*\])*)\s+([A-Za-z0-9_]+(?:,\s*[A-Za-z0-9_]+)*)\s*(?:=\s*[^;]+)?;/gm;

            let fieldMatch;
             while ((fieldMatch = fieldRegex.exec(classBody)) !== null) {
                const matchStartIndex = fieldMatch.index;
                const matchEndIndex = matchStartIndex + fieldMatch[0].length;

                let isInsideBlock = false;
                for (const span of codeBlockSpans) {
                    // Check if the start of the field declaration falls within a known code block
                    if (matchStartIndex >= span.start && matchStartIndex < span.end) {
                         isInsideBlock = true;
                         // console.log(`Field candidate "${fieldMatch[0].trim()}" is inside block [${span.start}-${span.end}], skipping.`);
                        break;
                    }
                }

                if (!isInsideBlock) {
                     // Handle multiple variables declared on the same line (e.g., int x, y;)
                     const accessModifier = fieldMatch[1] || 'package-private';
                     const nonAccessModifier = (fieldMatch[2] || '').trim();
                     const dataType = fieldMatch[3].trim();
                     const names = fieldMatch[4].split(',').map(name => name.trim());

                     names.forEach(name => {
                         if (name) { // Ensure name is not empty after split/trim
                            parsedClassData.fields.push({
                                accessModifier: accessModifier,
                                nonAccessModifier: nonAccessModifier,
                                dataType: dataType,
                                name: name,
                            });
                         }
                     });
                }
             }

            // --- Final Check ---
             if(!parsedClassData.name) {
                  throw new Error("Parsed class data is missing a name after processing.");
             }


            return {
                success: true,
                message: 'Code parsed successfully',
                classData: parsedClassData
            };

        } catch (error) {
            console.error(`Error parsing Java code for class "${parsedClassData.name || 'Unknown'}":`, error);
            return {
                success: false,
                message: `Error parsing code: ${error.message}`,
                classData: null
            };
        }
    }

    removeComments(code) {
        // Replace multi-line comments /* ... */ with spaces to preserve line counts/indices
        let cleanCode = code.replace(/\/\*[\s\S]*?\*\//g, match => {
             const lines = match.split('\n').length - 1;
             return '\n'.repeat(lines) + ' '.repeat(match.length - lines); // Preserve newlines within comment
         });
        // Replace single-line comments // ... with spaces
        cleanCode = cleanCode.replace(/\/\/.*$/gm, match => ' '.repeat(match.length));
        return cleanCode;
    }


    async parseFiles(files) {
        console.log('Parsing files for class diagram...');

        this.classes = [];
        this.relationships = [];

        let successfulParses = 0;
        let failedParses = 0;

        try {
            const fileReadPromises = files.map(file => {
                return new Promise((resolve) => { // Removed reject for simplicity, always resolve
                    const reader = new FileReader();

                    reader.onload = (e) => {
                        const code = e.target.result;
                        let result = null; // Initialize result
                        try {
                            result = this.parseCode(code);

                            if (result && result.success && result.classData && result.classData.name) {
                                this.classes.push(result.classData);
                                successfulParses++;
                                // console.log(`Successfully parsed: ${result.classData.name} from ${file.name}`);
                            } else if (result && !result.success) {
                                console.warn(`Warning parsing ${file.name}: ${result.message}`);
                                failedParses++;
                            } else if (result && result.message.includes('Skipped')) {
                                 // console.log(`File ${file.name}: ${result.message}`);
                                 // Don't count as failure if intentionally skipped
                            }
                             else {
                                 // Handle cases where result might be null or unexpected
                                 console.warn(`Unexpected parsing outcome for ${file.name}. Result:`, result);
                                 failedParses++;
                             }
                        } catch (error) {
                            console.error(`Critical error during parsing logic for ${file.name}:`, error);
                            failedParses++;
                            // Log the result object state if it exists
                             if (result) {
                                 console.error("Parsing result state at time of error:", result);
                             }
                        } finally {
                             resolve(); // Ensure promise resolves even if parsing logic throws an error
                        }
                    };

                    reader.onerror = (error) => {
                        console.error(`Error reading file ${file.name}:`, error);
                        failedParses++;
                        resolve(); // Resolve even on file read error to not block Promise.all
                    };

                    reader.readAsText(file);
                });
            });

            await Promise.all(fileReadPromises);

            console.log(`Parsing complete. Successful: ${successfulParses}, Failed/Skipped: ${failedParses}`);

             if (this.classes.length > 0) {
                this.findRelationships();
             } else {
                 console.log("No classes were successfully parsed, skipping relationship finding.");
             }


            return {
                success: successfulParses > 0 || files.length === 0, // Consider success if at least one parsed or no files given
                message: `Parsed ${files.length} file(s). Found ${this.classes.length} class(es).`,
                classes: this.classes,
                relationships: this.relationships
            };
        } catch (error) {
            // This catch might be less likely now since individual promises resolve on error
            console.error('Error processing files (Promise.all level):', error);
            return {
                success: false,
                message: `Error processing files: ${error.message}`,
                classes: this.classes,
                 relationships: this.relationships
            };
        }
    }

     findRelationships() {
         this.relationships = [];
         if (!this.classes || this.classes.length === 0) return;

         const classNames = new Set(this.classes.map(c => c.name)); // Use Set for faster lookups

         this.classes.forEach(classData => {
             // Inheritance (Extends)
             if (classData.extendsClass) {
                 const parentExists = classNames.has(classData.extendsClass);
                 this.relationships.push({
                     type: 'inheritance',
                     from: classData.name,
                     to: classData.extendsClass,
                     externalTarget: !parentExists
                 });
                 if (!parentExists) {
                     // console.warn(`Parent class ${classData.extendsClass} for ${classData.name} not found in parsed files.`);
                 }
             }

             // Implementation (Implements)
             (classData.implementsInterfaces || []).forEach(interfaceName => {
                 this.relationships.push({
                     type: 'implementation',
                     from: classData.name,
                     to: interfaceName
                     // Could add externalTarget check if interfaces were parsed
                 });
             });
         });
         console.log(`Found ${this.relationships.length} relationships.`);
     }


    generateDiagram() {
        console.log('Generating diagram data...');

        if (!this.classes || this.classes.length === 0) {
            return {
                elements: [],
                relationships: [],
                success: false,
                message: 'No classes parsed to generate diagram'
            };
        }

        try {
            // Relationships are found after parsing completes in parseFiles
            return {
                elements: this.classes,
                relationships: this.relationships,
                success: true,
                message: `Generated diagram data with ${this.classes.length} class(es) and ${this.relationships.length} relationship(s).`
            };
        } catch (error) {
            console.error('Error generating diagram data structure:', error);
            return {
                elements: [],
                relationships: [],
                success: false,
                message: `Error generating diagram data: ${error.message}`
            };
        }
    }

    renderDiagram(container, diagramData) {
        console.log('Rendering class diagram...');

        // Clear container immediately
        container.innerHTML = '';

        if (!diagramData || !diagramData.success || !diagramData.elements || diagramData.elements.length === 0) {
             const message = diagramData ? diagramData.message : 'No diagram data available.';
            console.warn("Render condition not met:", message);
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #777; font-family: Arial, sans-serif;">
                    <i class="fas fa-info-circle" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                    ${message}
                </div>`;
            return {
                success: false,
                message: message
            };
        }

        try {
            const diagramsContainer = document.createElement('div');
            diagramsContainer.className = 'class-diagrams-container';
            diagramsContainer.style.display = 'flex';
            diagramsContainer.style.flexWrap = 'wrap';
            diagramsContainer.style.gap = '25px';
            diagramsContainer.style.padding = '20px';
            diagramsContainer.style.justifyContent = 'center';
            diagramsContainer.style.fontFamily = 'Arial, sans-serif';

            diagramData.elements.forEach(classData => {
                if (!classData || !classData.name) {
                     console.warn("Skipping rendering of invalid class data:", classData);
                     return; // Skip this iteration if classData is malformed
                }

                const classDiagram = document.createElement('div');
                classDiagram.className = `class-diagram class-${classData.name}`;
                classDiagram.style.width = '300px';
                classDiagram.style.border = '1px solid #ccc';
                classDiagram.style.borderRadius = '5px';
                classDiagram.style.overflow = 'hidden';
                classDiagram.style.backgroundColor = '#ffffff';
                classDiagram.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
                classDiagram.style.margin = '10px';
                classDiagram.style.display = 'flex';
                classDiagram.style.flexDirection = 'column';


                // --- Class Name Section ---
                const classNameSection = document.createElement('div');
                classNameSection.className = 'class-name-section';
                classNameSection.style.backgroundColor = '#f0f0f0';
                classNameSection.style.color = '#333';
                classNameSection.style.padding = '10px 15px';
                classNameSection.style.textAlign = 'center';
                classNameSection.style.fontWeight = 'bold';
                classNameSection.style.borderBottom = '1px solid #ccc';
                classNameSection.textContent = classData.name;
                 let inheritanceInfo = '';
                 if (classData.extendsClass) {
                     inheritanceInfo += ` extends ${classData.extendsClass}`;
                 }
                 if (classData.implementsInterfaces && classData.implementsInterfaces.length > 0) {
                     inheritanceInfo += ` implements ${classData.implementsInterfaces.join(', ')}`;
                 }
                 if (inheritanceInfo) {
                     const subtitle = document.createElement('div');
                     subtitle.style.fontSize = '0.8em';
                     subtitle.style.fontWeight = 'normal';
                     subtitle.style.marginTop = '4px';
                     subtitle.style.color = '#555';
                     subtitle.textContent = inheritanceInfo;
                     classNameSection.appendChild(subtitle);
                 }


                // --- Fields (Attributes) Section ---
                const fieldsSection = document.createElement('div');
                fieldsSection.className = 'fields-section';
                fieldsSection.style.padding = '10px 15px';
                fieldsSection.style.borderBottom = '1px solid #eee';
                fieldsSection.style.fontSize = '0.9em';
                const fields = classData.fields || []; // Ensure fields is an array

                if (!this.config.showAttributes || fields.length === 0) {
                    const noFields = document.createElement('div');
                    noFields.style.fontStyle = 'italic';
                    noFields.style.color = '#999';
                    noFields.textContent = this.config.showAttributes ? '(No attributes)' : '(Attributes hidden)';
                    fieldsSection.appendChild(noFields);
                } else {
                    fields.forEach(field => {
                         if (!field || !field.name || !field.dataType) {
                              console.warn("Skipping rendering of invalid field data:", field);
                              return;
                         }
                        const fieldElement = document.createElement('div');
                        fieldElement.style.marginBottom = '4px';
                        fieldElement.style.lineHeight = '1.4';
                        fieldElement.style.wordBreak = 'break-word';

                        const accessModSymbol = this.getAccessModifierSymbol(field.accessModifier);
                        const accessModColor = this.getAccessModifierColor(field.accessModifier);

                        fieldElement.innerHTML = `
                            <span style="color: ${accessModColor}; font-weight: bold; margin-right: 5px; width: 10px; display: inline-block;" title="${field.accessModifier}">${accessModSymbol}</span>
                            ${field.nonAccessModifier ? `<span style="font-style: italic; color: #666;">${field.nonAccessModifier}</span> ` : ''}
                            <span style="color: #333; font-weight: bold;">${field.name}</span>:
                            <span style="color: #007bff;">${field.dataType}</span>`;
                        fieldsSection.appendChild(fieldElement);
                    });
                }

                // --- Methods Section ---
                const methodsSection = document.createElement('div');
                methodsSection.className = 'methods-section';
                methodsSection.style.padding = '10px 15px';
                methodsSection.style.fontSize = '0.9em';
                const methods = classData.methods || []; // Ensure methods is an array

                if (!this.config.showMethods || methods.length === 0) {
                    const noMethods = document.createElement('div');
                    noMethods.style.fontStyle = 'italic';
                    noMethods.style.color = '#999';
                    noMethods.textContent = this.config.showMethods ? '(No methods)' : '(Methods hidden)';
                    methodsSection.appendChild(noMethods);
                } else {
                    methods.forEach(method => {
                         if (!method || !method.name || !method.returnType || !method.parameters) {
                              console.warn("Skipping rendering of invalid method data:", method);
                              return;
                         }
                        const methodElement = document.createElement('div');
                        methodElement.style.marginBottom = '4px';
                        methodElement.style.lineHeight = '1.4';
                        methodElement.style.wordBreak = 'break-word';

                        const accessModSymbol = this.getAccessModifierSymbol(method.accessModifier);
                        const accessModColor = this.getAccessModifierColor(method.accessModifier);

                        const params = method.parameters.map(p => `<span style="color: #007bff;">${p.dataType || '?'}</span> ${p.name || '?'}`).join(', ');

                        methodElement.innerHTML = `
                            <span style="color: ${accessModColor}; font-weight: bold; margin-right: 5px; width: 10px; display: inline-block;" title="${method.accessModifier}">${accessModSymbol}</span>
                            ${method.nonAccessModifier ? `<span style="font-style: italic; color: #666;">${method.nonAccessModifier}</span> ` : ''}
                            <span style="color: #333; font-weight: bold;">${method.name}</span>(${params})
                            ${!method.isConstructor ? `: <span style="color: #007bff;">${method.returnType}</span>` : ''}`;
                        methodsSection.appendChild(methodElement);
                    });
                }

                // --- Assemble the class diagram ---
                classDiagram.appendChild(classNameSection);
                if (this.config.showAttributes) classDiagram.appendChild(fieldsSection);
                if (this.config.showMethods) classDiagram.appendChild(methodsSection);

                diagramsContainer.appendChild(classDiagram);
            });

            container.appendChild(diagramsContainer);

             // Relationship rendering placeholder
             if (this.config.showRelationships && diagramData.relationships && diagramData.relationships.length > 0) {
                 // console.log("Relationship rendering is not implemented in this basic HTML renderer.");
                 const relationshipInfo = document.createElement('div');
                 relationshipInfo.style.textAlign = 'center';
                 relationshipInfo.style.padding = '10px';
                 relationshipInfo.style.fontSize = '0.9em';
                 relationshipInfo.style.color = '#888';
                 relationshipInfo.textContent = `(${diagramData.relationships.length} relationships found, rendering not implemented)`;
                 container.appendChild(relationshipInfo);
             }


            return {
                success: true,
                message: 'Diagram rendered successfully'
            };
        } catch (error) {
            console.error('Error during diagram rendering loop:', error);
            container.innerHTML = `
                <div style="text-align: center; color: #dc3545; border: 1px solid #dc3545; padding: 15px; margin: 10px; border-radius: 5px; font-family: Arial, sans-serif;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
                    <p style="margin:0;">Error rendering diagram: ${error.message}</p>
                </div>`;
            return {
                success: false,
                message: `Error rendering diagram: ${error.message}`
            };
        }
    }


    getAccessModifierSymbol(accessModifier) {
        switch (String(accessModifier).toLowerCase()) { // Add String() for safety
            case 'private': return '-';
            case 'public': return '+';
            case 'protected': return '#';
            case 'package-private': return '~';
            default: return '?';
        }
    }

    getAccessModifierColor(accessModifier) {
         switch (String(accessModifier).toLowerCase()) { // Add String() for safety
            case 'private': return '#e74c3c';
            case 'public': return '#2ecc71';
            case 'protected': return '#f39c12';
            case 'package-private': return '#3498db';
            default: return '#333';
        }
    }

    async exportAsPNG(filename = 'class-diagram.png') {
        console.log('Exporting class diagram as PNG...');

        const diagramContainer = document.querySelector('.class-diagrams-container');
        if (!diagramContainer) {
            const message = 'Diagram container (.class-diagrams-container) not found for export.';
            console.error(message);
             alert(message); // Notify user directly
            return { success: false, message: message };
        }
         if (typeof html2canvas === 'undefined') {
             const message = 'html2canvas library is not loaded. Cannot export as PNG.';
             console.error(message);
              alert(message);
             return { success: false, message: message };
         }


        try {
             console.log('Running html2canvas...');
            const canvas = await html2canvas(diagramContainer, {
                 scale: 2,
                 useCORS: true,
                 logging: false // Disable detailed logging unless debugging html2canvas itself
            });
             console.log('html2canvas completed.');

            return new Promise((resolve) => {
                canvas.toBlob(blob => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const downloadLink = document.createElement('a');
                        downloadLink.href = url;
                        downloadLink.download = filename;
                        document.body.appendChild(downloadLink);
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                        URL.revokeObjectURL(url);
                        const message = 'Diagram exported successfully as PNG.';
                        console.log(message);
                        resolve({ success: true, message: message });
                    } else {
                        const message = 'Canvas to Blob conversion failed.';
                        console.error(message);
                         alert(message); // Notify user
                        resolve({ success: false, message: message });
                    }
                }, 'image/png');
            });
        } catch (error) {
            const message = `Error exporting diagram via html2canvas: ${error.message}`;
            console.error(message, error);
             alert(message); // Notify user
            return { success: false, message: message };
        }
    }
}

// Ensure it's attached to window if not using modules
if (typeof window !== 'undefined') {
    window.ClassDiagramGenerator = ClassDiagramGenerator;
}
