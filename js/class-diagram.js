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
        if (startIndex < 0 || code[startIndex] !== '{') {
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
        return -1;
    }


    parseCode(code) {
        console.log('Parsing code for class diagram (v2)...');

        const parsedClassData = {
             name: null,
             extendsClass: null,
             implementsInterfaces: [],
             fields: [],
             methods: []
        };
        const codeBlockSpans = [];

        try {
            let cleanCode = this.removeComments(code);

            const classSignatureRegex = /class\s+([A-Za-z0-9_]+)(\s+extends\s+([A-Za-z0-9_]+))?(\s+implements\s+([A-Za-z0-9_,\s]+))?/;
            const classMatch = cleanCode.match(classSignatureRegex);
            if (!classMatch) {
                 if (cleanCode.match(/interface\s+[A-Za-z0-9_]+/)) {
                     console.log("Skipping interface definition.");
                     return { success: true, message: 'Skipped interface.', classes: [] };
                 }
                 if (cleanCode.match(/enum\s+[A-Za-z0-9_]+/)) {
                     console.log("Skipping enum definition.");
                     return { success: true, message: 'Skipped enum.', classes: [] };
                 }
                throw new Error('No class definition found');
            }

            parsedClassData.name = classMatch[1];
            parsedClassData.extendsClass = classMatch[3] || null;
            parsedClassData.implementsInterfaces = classMatch[5] ? classMatch[5].split(',').map(i => i.trim()) : [];
            const className = parsedClassData.name;

            const classBodyStartIndex = cleanCode.indexOf('{', classMatch.index);
            if (classBodyStartIndex === -1) {
                 throw new Error('Could not find opening brace for class body');
            }
            const classBodyEndIndex = this.findMatchingBrace(cleanCode, classBodyStartIndex);
             if (classBodyEndIndex === -1) {
                 throw new Error('Could not find closing brace for class body');
             }
            const classBody = cleanCode.substring(classBodyStartIndex + 1, classBodyEndIndex);

            const methodOrConstructorRegex = /(?:^|\n|\r)\s*(private|public|protected)?((?:\s+(?:static|final|abstract|synchronized|native))*)\s*(?:([A-Za-z0-9_<>\[\].]+)\s+)?([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*(?:throws\s+[A-Za-z0-9_,\s]+)?\s*\{/g;
            let blockMatch;
            let methodIndex = 0;

            while ((blockMatch = methodOrConstructorRegex.exec(classBody)) !== null) {
                const signatureEndIndex = blockMatch.index + blockMatch[0].length - 1;
                const bodyStartIndexInClassBody = signatureEndIndex;
                const bodyEndIndexInClassBody = this.findMatchingBrace(classBody, bodyStartIndexInClassBody);

                if (bodyEndIndexInClassBody !== -1) {
                    codeBlockSpans.push({ start: blockMatch.index, end: bodyEndIndexInClassBody });

                    const methodName = blockMatch[4];
                    const isConstructor = methodName === className && blockMatch[3] === undefined;

                    if (['if', 'for', 'while', 'switch', 'catch', 'try', 'synchronized'].includes(methodName) && blockMatch[3] === undefined) {
                       console.warn(`Regex matched potential control flow '${methodName}', skipping block.`);
                       continue;
                    }

                    const paramsString = blockMatch[5] || '';
                    const params = paramsString.split(',').map(param => {
                        param = param.trim();
                        if (!param) return null;
                        const parts = param.split(/\s+/);
                        if (parts.length === 1) {
                             return { dataType: parts[0], name: '_unnamed_' };
                        }
                         const name = parts[parts.length - 1];
                         const dataType = parts.slice(0, -1).join(' ');
                        return {
                            dataType: dataType || 'Unknown',
                            name: name
                        };
                    }).filter(p => p !== null);

                    parsedClassData.methods.push({
                        id: methodIndex++,
                        accessModifier: blockMatch[1] || 'package-private',
                        nonAccessModifier: (blockMatch[2] || '').trim(),
                        returnType: isConstructor ? 'constructor' : (blockMatch[3] || 'void'),
                        name: methodName,
                        parameters: params,
                        isConstructor: isConstructor
                    });
                } else {
                     console.warn(`Could not find matching brace for block starting near index ${bodyStartIndexInClassBody} in class body for method/constructor: ${blockMatch[4]}`);
                }
            }


            const staticBlockRegex = /(?:^|\n|\r)\s*static\s*\{/g;
             while ((blockMatch = staticBlockRegex.exec(classBody)) !== null) {
                const bodyStartIndexInClassBody = blockMatch.index + blockMatch[0].length - 1;
                const bodyEndIndexInClassBody = this.findMatchingBrace(classBody, bodyStartIndexInClassBody);

                if (bodyEndIndexInClassBody !== -1) {
                    codeBlockSpans.push({ start: blockMatch.index, end: bodyEndIndexInClassBody });
                } else {
                     console.warn(`Could not find matching brace for static block starting near index ${bodyStartIndexInClassBody} in class body.`);
                }
            }

             const fieldRegex = /^[ \t]*(private|public|protected)?((?:\s+(?:static|final|transient|volatile))*)\s+([A-Za-z0-9_<>\[\].]+(?:\s*\[\s*\])*)\s+([A-Za-z0-9_]+)\s*(?:=\s*[^;]+)?;/gm;

            let fieldMatch;
             while ((fieldMatch = fieldRegex.exec(classBody)) !== null) {
                const matchStartIndex = fieldMatch.index;
                const matchEndIndex = matchStartIndex + fieldMatch[0].length;

                let isInsideBlock = false;
                for (const span of codeBlockSpans) {
                    if (matchStartIndex > span.start && matchStartIndex < span.end) {
                         isInsideBlock = true;
                        break;
                    }
                }

                if (!isInsideBlock) {
                    parsedClassData.fields.push({
                        accessModifier: fieldMatch[1] || 'package-private',
                        nonAccessModifier: (fieldMatch[2] || '').trim(),
                        dataType: fieldMatch[3].trim(),
                        name: fieldMatch[4].trim(),
                    });
                }
             }

             if(!parsedClassData.name) {
                  throw new Error("Parsed class data is missing a name.");
             }


            return {
                success: true,
                message: 'Code parsed successfully',
                classData: parsedClassData
            };

        } catch (error) {
            console.error('Error parsing Java code:', error);
            return {
                success: false,
                message: `Error parsing code: ${error.message}`,
                classData: null
            };
        }
    }

    removeComments(code) {
        let cleanCode = code.replace(/\/\*[\s\S]*?\*\//g, match => ' '.repeat(match.length));
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
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();

                    reader.onload = (e) => {
                        const code = e.target.result;
                        try {
                            const result = this.parseCode(code);

                            if (result.success && result.classData && result.classData.name) {
                                this.classes.push(result.classData);
                                successfulParses++;
                                console.log(`Successfully parsed: ${result.classData.name} from ${file.name}`);
                            } else if (!result.success) {
                                console.warn(`Warning parsing ${file.name}: ${result.message}`);
                                failedParses++;
                            } else {
                                console.log(`File ${file.name} parsed, but no class definition found or processed (${result.message}).`);
                            }
                            resolve();
                        } catch (error) {
                            console.error(`Critical error parsing ${file.name}:`, error);
                            failedParses++;
                            resolve();
                        }
                    };

                    reader.onerror = (error) => {
                        console.error(`Error reading file ${file.name}:`, error);
                        failedParses++;
                        reject(new Error(`Error reading file ${file.name}`));
                    };

                    reader.readAsText(file);
                });
            });

            await Promise.all(fileReadPromises);

            console.log(`Parsing complete. Successful: ${successfulParses}, Failed/Skipped: ${failedParses}`);

             this.findRelationships();


            return {
                success: true,
                message: `Parsed ${files.length} file(s). Found ${this.classes.length} class(es).`,
                classes: this.classes,
                relationships: this.relationships
            };
        } catch (error) {
            console.error('Error processing files:', error);
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
         const classNames = this.classes.map(c => c.name);

         this.classes.forEach(classData => {
             if (classData.extendsClass) {
                 if (classNames.includes(classData.extendsClass)) {
                     this.relationships.push({
                         type: 'inheritance',
                         from: classData.name,
                         to: classData.extendsClass
                     });
                 } else {
                     console.warn(`Parent class ${classData.extendsClass} for ${classData.name} not found in parsed files.`);
                      this.relationships.push({
                         type: 'inheritance',
                         from: classData.name,
                         to: classData.extendsClass,
                         externalTarget: true
                     });
                 }
             }

             classData.implementsInterfaces.forEach(interfaceName => {
                 this.relationships.push({
                     type: 'implementation',
                     from: classData.name,
                     to: interfaceName
                 });
             });

         });
         console.log("Found relationships:", this.relationships);
     }


    generateDiagram() {
        console.log('Generating diagram data...');

        if (this.classes.length === 0) {
            return {
                elements: [],
                relationships: [],
                success: false,
                message: 'No classes found to generate diagram'
            };
        }

        try {
            return {
                elements: this.classes,
                relationships: this.relationships,
                success: true,
                message: `Generated diagram data with ${this.classes.length} class(es) and ${this.relationships.length} relationship(s).`
            };
        } catch (error) {
            console.error('Error generating diagram data:', error);
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

        if (!diagramData || !diagramData.success || diagramData.elements.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #777;">
                    <i class="fas fa-info-circle" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                    ${diagramData ? diagramData.message : 'No diagram data available.'}
                </div>`;
            return {
                success: false,
                message: diagramData ? diagramData.message : 'No diagram data'
            };
        }

        try {
            container.innerHTML = '';

            const diagramsContainer = document.createElement('div');
            diagramsContainer.className = 'class-diagrams-container';
            diagramsContainer.style.display = 'flex';
            diagramsContainer.style.flexWrap = 'wrap';
            diagramsContainer.style.gap = '25px';
            diagramsContainer.style.padding = '20px';
            diagramsContainer.style.justifyContent = 'center';
            diagramsContainer.style.fontFamily = 'Arial, sans-serif';

            diagramData.elements.forEach(classData => {
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
                 if (classData.implementsInterfaces.length > 0) {
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


                const fieldsSection = document.createElement('div');
                fieldsSection.className = 'fields-section';
                fieldsSection.style.padding = '10px 15px';
                fieldsSection.style.borderBottom = '1px solid #eee';
                fieldsSection.style.fontSize = '0.9em';

                if (!this.config.showAttributes || classData.fields.length === 0) {
                    const noFields = document.createElement('div');
                    noFields.style.fontStyle = 'italic';
                    noFields.style.color = '#999';
                    noFields.textContent = this.config.showAttributes ? '(No attributes)' : '(Attributes hidden)';
                    fieldsSection.appendChild(noFields);
                } else {
                    classData.fields.forEach(field => {
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

                const methodsSection = document.createElement('div');
                methodsSection.className = 'methods-section';
                methodsSection.style.padding = '10px 15px';
                methodsSection.style.fontSize = '0.9em';

                if (!this.config.showMethods || classData.methods.length === 0) {
                    const noMethods = document.createElement('div');
                    noMethods.style.fontStyle = 'italic';
                    noMethods.style.color = '#999';
                    noMethods.textContent = this.config.showMethods ? '(No methods)' : '(Methods hidden)';
                    methodsSection.appendChild(noMethods);
                } else {
                    classData.methods.forEach(method => {
                        const methodElement = document.createElement('div');
                        methodElement.style.marginBottom = '4px';
                        methodElement.style.lineHeight = '1.4';
                        methodElement.style.wordBreak = 'break-word';

                        const accessModSymbol = this.getAccessModifierSymbol(method.accessModifier);
                        const accessModColor = this.getAccessModifierColor(method.accessModifier);

                        const params = method.parameters.map(p => `<span style="color: #007bff;">${p.dataType}</span> ${p.name}`).join(', ');

                        methodElement.innerHTML = `
                            <span style="color: ${accessModColor}; font-weight: bold; margin-right: 5px; width: 10px; display: inline-block;" title="${method.accessModifier}">${accessModSymbol}</span>
                            ${method.nonAccessModifier ? `<span style="font-style: italic; color: #666;">${method.nonAccessModifier}</span> ` : ''}
                            <span style="color: #333; font-weight: bold;">${method.name}</span>(${params})
                            ${!method.isConstructor ? `: <span style="color: #007bff;">${method.returnType}</span>` : ''}`;
                        methodsSection.appendChild(methodElement);
                    });
                }

                classDiagram.appendChild(classNameSection);
                if (this.config.showAttributes) classDiagram.appendChild(fieldsSection);
                if (this.config.showMethods) classDiagram.appendChild(methodsSection);

                diagramsContainer.appendChild(classDiagram);
            });

            container.appendChild(diagramsContainer);

             if (this.config.showRelationships && diagramData.relationships.length > 0) {
                 console.log("Relationship rendering is not implemented in this basic HTML renderer.");
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
            console.error('Error rendering class diagram:', error);
            container.innerHTML = `
                <div style="text-align: center; color: #dc3545; border: 1px solid #dc3545; padding: 15px; margin: 10px; border-radius: 5px;">
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
        switch (accessModifier.toLowerCase()) {
            case 'private': return '-';
            case 'public': return '+';
            case 'protected': return '#';
            case 'package-private': return '~';
            default: return '?';
        }
    }

    getAccessModifierColor(accessModifier) {
        switch (accessModifier.toLowerCase()) {
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
                 logging: true
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
                        resolve({ success: false, message: message });
                    }
                }, 'image/png');
            });
        } catch (error) {
            console.error('Error exporting class diagram via html2canvas:', error);
            return { success: false, message: `Error exporting diagram: ${error.message}` };
        }
    }
}

window.ClassDiagramGenerator = ClassDiagramGenerator;
