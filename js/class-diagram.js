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
        // console.log(`findMatchingBrace called at index: ${startIndex}`);
        if (startIndex < 0 || startIndex >= code.length || code[startIndex] !== '{') {
             console.warn("findMatchingBrace: Invalid start index or character:", startIndex, code ? code[startIndex] : 'N/A');
            return -1;
        }
        let braceLevel = 1;
        for (let i = startIndex + 1; i < code.length; i++) {
            const char = code[i];
            if (char === '{') {
                braceLevel++;
            } else if (char === '}') {
                braceLevel--;
                if (braceLevel === 0) {
                    // console.log(`findMatchingBrace: Found matching brace at index: ${i}`);
                    return i;
                }
            }
            // Basic skip for comments/strings - assumes comments are already removed mostly
            else if (char === '/' && code[i+1] === '/') {
                 const nextLineIndex = code.indexOf('\n', i);
                 i = (nextLineIndex === -1) ? code.length : nextLineIndex; // Jump to end or next line
            } else if (char === '/' && code[i+1] === '*') {
                 const commentEndIndex = code.indexOf('*/', i + 2);
                 i = (commentEndIndex === -1) ? code.length : commentEndIndex + 1; // Jump past '*/'
            } else if (char === '"') {
                i++;
                while(i < code.length && (code[i] !== '"' || code[i-1] === '\\')) { i++; }
            } else if (char === "'") {
                 i++;
                while(i < code.length && (code[i] !== "'" || code[i-1] === '\\')) { i++; }
            }
        }
         console.warn("findMatchingBrace: No matching brace found for index:", startIndex);
        return -1;
    }


    parseCode(code) {
        console.log('--- Starting parseCode (v5 - Async Fix) ---'); // Version updated

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

            const classSignatureRegex = /(?:^|\s)(?:public|private|protected)?\s*(?:abstract|final|static)?\s*class\s+([A-Za-z0-9_]+)(\s+extends\s+([A-Za-z0-9_<>,\s\.]+))?(\s+implements\s+([A-Za-z0-9_<>,\s\.]+))?/;
            let classMatch = cleanCode.match(classSignatureRegex);

            if (!classMatch) {
                 const simpleClassMatch = cleanCode.match(/class\s+([A-Za-z0-9_]+)/);
                 if (simpleClassMatch) {
                     console.log("Complex class signature regex failed, using simple match.");
                     classMatch = simpleClassMatch;
                     parsedClassData.name = classMatch[1];
                 } else if (cleanCode.match(/interface\s+[A-Za-z0-9_]+/)) {
                     console.log("Skipping interface definition.");
                     return { success: true, message: 'Skipped interface.', classData: null };
                 } else if (cleanCode.match(/enum\s+[A-Za-z0-9_]+/)) {
                     console.log("Skipping enum definition.");
                     return { success: true, message: 'Skipped enum.', classData: null };
                 } else {
                    throw new Error('No class definition found');
                 }
            } else {
                 parsedClassData.name = classMatch[1];
                 parsedClassData.extendsClass = classMatch[3] ? classMatch[3].trim() : null;
                 parsedClassData.implementsInterfaces = classMatch[5] ? classMatch[5].split(',').map(i => i.trim().split('<')[0]) : [];
            }

            const className = parsedClassData.name;
            if (!className) {
                 throw new Error('Failed to extract class name.');
            }
            console.log(`Class Name Found: ${className}`);
            // console.log(`Extends: ${parsedClassData.extendsClass}, Implements: ${parsedClassData.implementsInterfaces.join(', ')}`);


            const classSignatureEndIndex = classMatch.index + classMatch[0].length;
            let classBodyStartIndex = -1;
            let openBraceIndex = classSignatureEndIndex;
            while(openBraceIndex < cleanCode.length) {
                classBodyStartIndex = cleanCode.indexOf('{', openBraceIndex);
                if (classBodyStartIndex === -1) break;
                const betweenText = cleanCode.substring(classSignatureEndIndex, classBodyStartIndex);
                if (!betweenText.includes('/*') && !betweenText.includes('//') && !betweenText.includes('"') && !betweenText.includes("'")) {
                     break;
                }
                openBraceIndex = classBodyStartIndex + 1;
            }


            if (classBodyStartIndex === -1) {
                 throw new Error(`Could not find opening brace '{' for class body of ${className}`);
            }
            // console.log(`Class Body Start Brace Index: ${classBodyStartIndex}`);
            const classBodyEndIndex = this.findMatchingBrace(cleanCode, classBodyStartIndex);
             if (classBodyEndIndex === -1) {
                 throw new Error(`Could not find closing brace '}' for class body of ${className}`);
             }
             // console.log(`Class Body End Brace Index: ${classBodyEndIndex}`);
            const classBody = cleanCode.substring(classBodyStartIndex + 1, classBodyEndIndex);


            // --- Block Identification Pass ---
            let blockMatch;
            let methodIndex = 0;
            const controlFlowKeywords = new Set(['if', 'for', 'while', 'switch', 'catch', 'try', 'synchronized']);

            // 1. Identify Constructors
            // console.log("--- Identifying Constructors ---");
            const constructorRegex = new RegExp(`(?:^|\\n|\\r)\\s*(private|public|protected)?\\s*${className}\\s*\\(([^)]*)\\)\\s*(?:throws\\s+[A-Za-z0-9_,\\s]+)?\\s*\\{`, 'g');
            while ((blockMatch = constructorRegex.exec(classBody)) !== null) {
                 // console.log("Constructor Candidate Found:", blockMatch[0].trim());
                 const signatureEndIndex = blockMatch.index + blockMatch[0].length - 1;
                 const bodyEndIndexInClassBody = this.findMatchingBrace(classBody, signatureEndIndex);

                 if (bodyEndIndexInClassBody !== -1) {
                     // console.log(`   -> Brace found. Span: [${blockMatch.index} - ${bodyEndIndexInClassBody}]`);
                     codeBlockSpans.push({ start: blockMatch.index, end: bodyEndIndexInClassBody, type: 'constructor' });

                     const paramsString = blockMatch[2] || '';
                     const params = paramsString.split(',').map(param => {
                         param = param.trim(); if (!param) return null;
                         const parts = param.split(/\s+/); const name = parts.pop() || '_unnamed_';
                         const dataType = parts.join(' ').trim() || 'Unknown';
                         return { dataType: dataType, name: name };
                     }).filter(p => p !== null);

                     parsedClassData.methods.push({
                         id: methodIndex++, accessModifier: blockMatch[1] || 'package-private',
                         nonAccessModifier: '', returnType: 'constructor', name: className,
                         parameters: params, isConstructor: true
                     });
                 } else {
                      console.warn(`   -> Could not find matching brace for constructor.`);
                 }
            }


            // 2. Identify Methods
            // console.log("--- Identifying Methods ---");
            const methodRegex = /(?:^|\n|\r)\s*(private|public|protected)?((?:\s+(?:static|final|abstract|synchronized|native))*)\s+([A-Za-z0-9_<>\[\].]+(?:\s*\[\s*\])*)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*(?:throws\s+[A-Za-z0-9_,\s]+)?\s*\{/g;
             while ((blockMatch = methodRegex.exec(classBody)) !== null) {
                 const methodName = blockMatch[4];
                 // console.log("Method Candidate Found:", methodName, "->", blockMatch[0].trim());

                 // *** FIX: Skip if it matches the class name (already handled by constructor) ***
                 if (methodName === className) {
                      // console.log(`   -> Skipping: Method name matches class name (handled as constructor).`);
                      continue;
                 }
                 if (controlFlowKeywords.has(methodName)) {
                     // console.log(`   -> Skipping: Matched control flow keyword.`);
                     continue;
                 }
                 if (methodName === 'new' || !blockMatch[3]) {
                      // console.log(`   -> Skipping: Looks like 'new' or missing return type.`);
                      continue;
                 }

                 const signatureEndIndex = blockMatch.index + blockMatch[0].length - 1;
                 const bodyEndIndexInClassBody = this.findMatchingBrace(classBody, signatureEndIndex);

                 if (bodyEndIndexInClassBody !== -1) {
                     // console.log(`   -> Brace found. Span: [${blockMatch.index} - ${bodyEndIndexInClassBody}]`);
                     let isInsideAnotherBlock = false;
                     for(const span of codeBlockSpans) {
                          if(blockMatch.index > span.start && blockMatch.index < span.end) {
                               // console.warn(`   -> Skipping: Method start index ${blockMatch.index} is inside existing block [${span.start}-${span.end}] (${span.type})`);
                               isInsideAnotherBlock = true; break;
                          }
                     }
                     if (isInsideAnotherBlock) continue;

                     codeBlockSpans.push({ start: blockMatch.index, end: bodyEndIndexInClassBody, type: 'method' });

                     const paramsString = blockMatch[5] || '';
                     const params = paramsString.split(',').map(param => {
                         param = param.trim(); if (!param) return null;
                         const parts = param.split(/\s+/); const name = parts.pop() || '_unnamed_';
                         const dataType = parts.join(' ').trim() || 'Unknown';
                         return { dataType: dataType, name: name };
                     }).filter(p => p !== null);

                     parsedClassData.methods.push({
                         id: methodIndex++, accessModifier: blockMatch[1] || 'package-private',
                         nonAccessModifier: (blockMatch[2] || '').trim(), returnType: blockMatch[3].trim(),
                         name: methodName, parameters: params, isConstructor: false
                     });
                 } else {
                      console.warn(`   -> Could not find matching brace for method ${methodName}.`);
                 }
            }


            // 3. Identify Static Initializer Blocks
            // console.log("--- Identifying Static Blocks ---");
            const staticBlockRegex = /(?:^|\n|\r)\s*static\s*\{/g;
             while ((blockMatch = staticBlockRegex.exec(classBody)) !== null) {
                 // console.log("Static Block Candidate Found:", blockMatch[0].trim());
                 const bodyStartIndexInClassBody = blockMatch.index + blockMatch[0].length - 1;
                 const bodyEndIndexInClassBody = this.findMatchingBrace(classBody, bodyStartIndexInClassBody);
                 if (bodyEndIndexInClassBody !== -1) {
                      // console.log(`   -> Brace found. Span: [${blockMatch.index} - ${bodyEndIndexInClassBody}]`);
                     codeBlockSpans.push({ start: blockMatch.index, end: bodyEndIndexInClassBody, type: 'static_block' });
                 } else {
                      console.warn(`   -> Could not find matching brace for static block.`);
                 }
            }

            codeBlockSpans.sort((a, b) => a.start - b.start);
            // console.log("Identified Code Block Spans:", codeBlockSpans);

            // --- Field Identification Pass ---
            // console.log("--- Identifying Fields ---");
            const fieldRegex = /(?:^|\n|\r)\s*(private|public|protected)?((?:\s+(?:static|final|transient|volatile))*)\s+([A-Za-z0-9_<>\[\].]+(?:\s*\[\s*\])*)\s+([A-Za-z0-9_]+(?:\s*,\s*[A-Za-z0-9_]+)*)\s*(?:=\s*[^;]+)?;/g;
            let fieldMatch;
             while ((fieldMatch = fieldRegex.exec(classBody)) !== null) {
                const matchStartIndex = fieldMatch.index;
                const declarationStartIndex = classBody.lastIndexOf('\n', matchStartIndex) + 1;
                 // console.log(`Field Candidate Found: "${fieldMatch[0].trim()}" at index ${matchStartIndex}`);

                let isInsideBlock = false;
                for (const span of codeBlockSpans) {
                    if (declarationStartIndex >= span.start && declarationStartIndex < span.end) {
                         isInsideBlock = true;
                         // console.log(`   -> Skipping: Field candidate is inside block [${span.start}-${span.end}] (${span.type})`);
                        break;
                    }
                }

                if (!isInsideBlock) {
                     // console.log("   -> Identified as Field.");
                     const accessModifier = fieldMatch[1] || 'package-private';
                     const nonAccessModifier = (fieldMatch[2] || '').trim();
                     const dataType = fieldMatch[3].trim();
                     const names = fieldMatch[4].split(',').map(name => name.trim());
                     names.forEach(name => {
                         if (name) {
                            parsedClassData.fields.push({
                                accessModifier: accessModifier, nonAccessModifier: nonAccessModifier,
                                dataType: dataType, name: name,
                            });
                         }
                     });
                }
             }

            // --- Final Check ---
             if(!parsedClassData.name) { throw new Error("Parsed class data is missing a name after processing."); }
             if(parsedClassData.fields.length === 0 && parsedClassData.methods.length === 0) {
                  console.warn(`Parsing resulted in 0 fields and 0 methods for class ${className}. Check regexes and block detection.`);
             }

             console.log("--- parseCode Finished ---");
             // console.log("Final Parsed Fields:", parsedClassData.fields);
             // console.log("Final Parsed Methods:", parsedClassData.methods.map(m=>m.name));

            return { success: true, message: 'Code parsed successfully', classData: parsedClassData };

        } catch (error) {
            console.error(`Error parsing Java code for class "${parsedClassData.name || 'Unknown'}":`, error);
            console.error("Parsed Class Data state at error:", parsedClassData);
            console.error("Code Block Spans state at error:", codeBlockSpans);
            return { success: false, message: `Error parsing code: ${error.message}`, classData: null };
        }
    }

    removeComments(code) {
        let cleanCode = code.replace(/\/\*[\s\S]*?\*\//g, match => {
             const lines = match.split('\n').length - 1;
             return '\n'.repeat(lines) + ' '.repeat(match.length - lines);
         });
        cleanCode = cleanCode.replace(/\/\/.*$/gm, match => ' '.repeat(match.length));
        return cleanCode;
    }


    async parseFiles(files) {
        console.log('--- Starting parseFiles ---');
        this.classes = []; // Ensure reset at the start
        this.relationships = [];
        let successfulParses = 0;
        let failedParses = 0;

        if (!files || files.length === 0) {
             console.warn("parseFiles called with no files.");
             return { success: true, message: "No files provided.", classes: [], relationships: [] };
        }

        try {
            const fileReadPromises = Array.from(files).map(file => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const code = e.target.result;
                        let result = null;
                        try {
                            result = this.parseCode(code);
                            if (result && result.success && result.classData && result.classData.name) {
                                this.classes.push(result.classData);
                                // *** ADDED LOG ***
                                console.log(`>>> Successfully pushed class: ${result.classData.name}. Current count: ${this.classes.length}`);
                                successfulParses++;
                            } else if (result && !result.success) {
                                console.warn(`Parsing failed for ${file.name}: ${result.message}`);
                                failedParses++;
                            } else if (result && result.message && result.message.includes('Skipped')) {
                                // Skipped interface/enum
                            } else {
                                console.warn(`Unexpected parsing outcome for ${file.name}. Result:`, result);
                                failedParses++;
                            }
                        } catch (parseError) {
                            console.error(`Critical error during parseCode call for ${file.name}:`, parseError);
                            failedParses++;
                        } finally {
                            resolve();
                        }
                    };
                    reader.onerror = (error) => {
                        console.error(`Error reading file ${file.name}:`, error);
                        failedParses++;
                        resolve();
                    };
                    reader.readAsText(file);
                });
            });

            // *** IMPORTANT: Wait for ALL promises to resolve ***
            await Promise.all(fileReadPromises);

            console.log(`--- File Parsing Complete ---`);
            console.log(`Total Files: ${files.length}, Successful Parses: ${successfulParses}, Failed/Skipped: ${failedParses}`);
            console.log(`Final this.classes count after Promise.all: ${this.classes.length}`); // Log count after all files processed

            if (this.classes.length > 0) {
                this.findRelationships();
            } else {
                console.log("No classes were successfully parsed, skipping relationship finding.");
            }

            // Return the result AFTER awaiting
            return {
                success: successfulParses > 0 || files.length === 0,
                message: `Parsed ${files.length} file(s). Found ${this.classes.length} class(es).`,
                classes: this.classes,
                relationships: this.relationships
            };
        } catch (error) {
            console.error('Error in parseFiles Promise.all execution:', error);
            return {
                success: false, message: `Error processing files: ${error.message}`,
                classes: this.classes, relationships: this.relationships
            };
        }
    }

     findRelationships() {
         // console.log("--- Finding Relationships ---");
         this.relationships = [];
         if (!this.classes || this.classes.length === 0) return;
         const classNames = new Set(this.classes.map(c => c.name));

         this.classes.forEach(classData => {
             if (classData.extendsClass) {
                 const parentExists = classNames.has(classData.extendsClass);
                 this.relationships.push({ type: 'inheritance', from: classData.name, to: classData.extendsClass, externalTarget: !parentExists });
             }
             (classData.implementsInterfaces || []).forEach(interfaceName => {
                 this.relationships.push({ type: 'implementation', from: classData.name, to: interfaceName });
             });
         });
         // console.log(`Found ${this.relationships.length} relationships.`);
     }


    generateDiagram() {
        // *** ADDED LOG ***
        console.log('--- Generating Diagram Data ---');
        console.log('>>> generateDiagram called. Current this.classes:', JSON.stringify(this.classes.map(c => c.name))); // Log names

        if (!this.classes || this.classes.length === 0) {
            console.log("No classes available to generate diagram data.");
            return { elements: [], relationships: [], success: false, message: 'No classes parsed to generate diagram' };
        }
        try {
            // console.log(`Generating data for ${this.classes.length} classes and ${this.relationships.length} relationships.`);
            return {
                elements: this.classes, relationships: this.relationships,
                success: true, message: `Generated diagram data.`
            };
        } catch (error) {
            console.error('Error generating diagram data structure:', error);
            return { elements: [], relationships: [], success: false, message: `Error generating diagram data: ${error.message}` };
        }
    }

    renderDiagram(container, diagramData) {
        console.log('--- Starting renderDiagram ---');
        container.innerHTML = '';

        if (!diagramData || !diagramData.success || !diagramData.elements || diagramData.elements.length === 0) {
             const message = diagramData ? (diagramData.message || 'Unknown reason') : 'Diagram data is missing.';
            console.warn(`Render condition not met: ${message}`);
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: #777; font-family: Arial, sans-serif;">... ${message} ...</div>`;
            return { success: false, message: message };
        }
        // console.log(`Rendering ${diagramData.elements.length} diagram elements.`);

        try {
            const diagramsContainer = document.createElement('div');
            diagramsContainer.className = 'class-diagrams-container';
            diagramsContainer.style.display = 'flex';
            diagramsContainer.style.flexWrap = 'wrap';
            diagramsContainer.style.gap = '25px';
            diagramsContainer.style.padding = '20px';
            diagramsContainer.style.justifyContent = 'center';
            diagramsContainer.style.fontFamily = 'Arial, sans-serif';

            diagramData.elements.forEach((classData, index) => {
                // console.log(`Rendering element ${index}: ${classData ? classData.name : 'Invalid Data'}`);
                if (!classData || !classData.name) {
                     console.warn("Skipping rendering of invalid class data at index:", index, classData);
                     return;
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
                 if (classData.extendsClass) { inheritanceInfo += ` extends ${classData.extendsClass}`; }
                 if (classData.implementsInterfaces && classData.implementsInterfaces.length > 0) { inheritanceInfo += ` implements ${classData.implementsInterfaces.join(', ')}`; }
                 if (inheritanceInfo) {
                     const subtitle = document.createElement('div');
                     subtitle.style.fontSize = '0.8em'; subtitle.style.fontWeight = 'normal';
                     subtitle.style.marginTop = '4px'; subtitle.style.color = '#555';
                     subtitle.textContent = inheritanceInfo;
                     classNameSection.appendChild(subtitle);
                 }
                 classDiagram.appendChild(classNameSection); // Append Name Section

                 // --- Fields (Attributes) Section ---
                 if (this.config.showAttributes) {
                     const fieldsSection = document.createElement('div');
                     fieldsSection.className = 'fields-section';
                     fieldsSection.style.padding = '10px 15px';
                     fieldsSection.style.borderBottom = '1px solid #eee';
                     fieldsSection.style.fontSize = '0.9em';
                     const fields = classData.fields || [];
                     if (fields.length === 0) {
                         fieldsSection.innerHTML = `<div style="font-style: italic; color: #999;">(No attributes)</div>`;
                     } else {
                         fields.forEach(field => {
                             if (!field || !field.name || !field.dataType) { console.warn("Skipping invalid field:", field); return; }
                             const fieldElement = document.createElement('div');
                             fieldElement.style.marginBottom = '4px'; fieldElement.style.lineHeight = '1.4'; fieldElement.style.wordBreak = 'break-word';
                             const accessModSymbol = this.getAccessModifierSymbol(field.accessModifier);
                             const accessModColor = this.getAccessModifierColor(field.accessModifier);
                             fieldElement.innerHTML = `<span style="color: ${accessModColor}; font-weight: bold; margin-right: 5px; width: 10px; display: inline-block;" title="${field.accessModifier}">${accessModSymbol}</span> ${field.nonAccessModifier ? `<span style="font-style: italic; color: #666;">${field.nonAccessModifier}</span> ` : ''} <span style="color: #333; font-weight: bold;">${field.name}</span>: <span style="color: #007bff;">${field.dataType}</span>`;
                             fieldsSection.appendChild(fieldElement);
                         });
                     }
                     classDiagram.appendChild(fieldsSection); // Append Fields Section
                 }

                 // --- Methods Section ---
                 if (this.config.showMethods) {
                     const methodsSection = document.createElement('div');
                     methodsSection.className = 'methods-section';
                     methodsSection.style.padding = '10px 15px';
                     methodsSection.style.fontSize = '0.9em';
                     const methods = classData.methods || [];
                     if (methods.length === 0) {
                         methodsSection.innerHTML = `<div style="font-style: italic; color: #999;">(No methods)</div>`;
                     } else {
                         methods.forEach(method => {
                             if (!method || !method.name || !method.returnType || !method.parameters) { console.warn("Skipping invalid method:", method); return; }
                             const methodElement = document.createElement('div');
                             methodElement.style.marginBottom = '4px'; methodElement.style.lineHeight = '1.4'; methodElement.style.wordBreak = 'break-word';
                             const accessModSymbol = this.getAccessModifierSymbol(method.accessModifier);
                             const accessModColor = this.getAccessModifierColor(method.accessModifier);
                             const params = method.parameters.map(p => `<span style="color: #007bff;">${p.dataType || '?'}</span> ${p.name || '?'}`).join(', ');
                             methodElement.innerHTML = `<span style="color: ${accessModColor}; font-weight: bold; margin-right: 5px; width: 10px; display: inline-block;" title="${method.accessModifier}">${accessModSymbol}</span> ${method.nonAccessModifier ? `<span style="font-style: italic; color: #666;">${method.nonAccessModifier}</span> ` : ''} <span style="color: #333; font-weight: bold;">${method.name}</span>(${params}) ${!method.isConstructor ? `: <span style="color: #007bff;">${method.returnType}</span>` : ''}`;
                             methodsSection.appendChild(methodElement);
                         });
                     }
                      classDiagram.appendChild(methodsSection); // Append Methods Section
                 }

                diagramsContainer.appendChild(classDiagram);
            });

            container.appendChild(diagramsContainer);

             // Relationship rendering placeholder
             if (this.config.showRelationships && diagramData.relationships && diagramData.relationships.length > 0) {
                 const relationshipInfo = document.createElement('div');
                 relationshipInfo.style.textAlign = 'center'; relationshipInfo.style.padding = '10px';
                 relationshipInfo.style.fontSize = '0.9em'; relationshipInfo.style.color = '#888';
                 relationshipInfo.textContent = `(${diagramData.relationships.length} relationships found, rendering not implemented)`;
                 container.appendChild(relationshipInfo);
             }

            // console.log("--- renderDiagram Finished Successfully ---");
            return { success: true, message: 'Diagram rendered successfully' };

        } catch (error) {
            console.error('Error during diagram rendering loop:', error);
            container.innerHTML = `<div style="text-align: center; color: #dc3545; border: 1px solid #dc3545; padding: 15px; margin: 10px; border-radius: 5px; font-family: Arial, sans-serif;"> Error rendering diagram: ${error.message}</div>`;
            return { success: false, message: `Error rendering diagram: ${error.message}` };
        }
    }


    getAccessModifierSymbol(accessModifier) {
        switch (String(accessModifier).toLowerCase()) {
            case 'private': return '-'; case 'public': return '+';
            case 'protected': return '#'; case 'package-private': return '~';
            default: return '?';
        }
    }

    getAccessModifierColor(accessModifier) {
         switch (String(accessModifier).toLowerCase()) {
            case 'private': return '#e74c3c'; case 'public': return '#2ecc71';
            case 'protected': return '#f39c12'; case 'package-private': return '#3498db';
            default: return '#333';
        }
    }

    async exportAsPNG(filename = 'class-diagram.png') {
        // console.log('--- Starting exportAsPNG ---');
        const diagramContainer = document.querySelector('.class-diagrams-container');
        if (!diagramContainer) {
            const message = 'Diagram container (.class-diagrams-container) not found for export.';
            console.error(message); alert(message);
            return { success: false, message: message };
        }
         if (typeof html2canvas === 'undefined') {
             const message = 'html2canvas library is not loaded. Cannot export as PNG.';
             console.error(message); alert(message);
             return { success: false, message: message };
         }

        try {
            // console.log('Running html2canvas...');
            const canvas = await html2canvas(diagramContainer, { scale: 2, useCORS: true, logging: false });
            // console.log('html2canvas completed.');
            return new Promise((resolve) => {
                canvas.toBlob(blob => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const downloadLink = document.createElement('a');
                        downloadLink.href = url; downloadLink.download = filename;
                        document.body.appendChild(downloadLink); downloadLink.click(); document.body.removeChild(downloadLink);
                        URL.revokeObjectURL(url);
                        // console.log('Diagram exported successfully as PNG.');
                        resolve({ success: true, message: 'Diagram exported successfully.' });
                    } else {
                        const message = 'Canvas to Blob conversion failed.';
                        console.error(message); alert(message);
                        resolve({ success: false, message: message });
                    }
                }, 'image/png');
            });
        } catch (error) {
            const message = `Error exporting diagram via html2canvas: ${error.message}`;
            console.error(message, error); alert(message);
            return { success: false, message: message };
        }
    }
}

// Ensure it's attached to window if not using modules
if (typeof window !== 'undefined') {
    window.ClassDiagramGenerator = ClassDiagramGenerator;
}
