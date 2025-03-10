/**
 * Class Diagram Generator
 * Generates UML class diagrams from Java code
 */

class ClassDiagramGenerator {
    constructor(options = {}) {
        // Default configuration
        this.config = {
            showMethods: true,
            showAttributes: true,
            showRelationships: true,
            showAccessModifiers: true,
            ...options
        };
        
        // Container for parsed class data
        this.classes = [];
        this.relationships = [];
    }
    
    /**
     * Parse Java code to extract class information
     * @param {string} code - Java code to parse
     * @returns {Object} - Parsed class data
     */
    parseCode(code) {
        console.log('Parsing code for class diagram...');
        
        // Clear previous data
        this.classes = [];
        
        try {
            // First, strip all comments from the code to avoid false matches
            let cleanCode = this.removeComments(code);
            
            // Extract class name
            const classMatch = cleanCode.match(/class\s+([A-Za-z0-9_]+)(\s+extends\s+([A-Za-z0-9_]+))?(\s+implements\s+([A-Za-z0-9_,\s]+))?/);
            if (!classMatch) {
                throw new Error('No class definition found');
            }
            
            const className = classMatch[1];
            const extendsClass = classMatch[3] || null;
            const implementsInterfaces = classMatch[5] ? classMatch[5].split(',').map(i => i.trim()) : [];
            
            // Extract the class body (to distinguish class fields from local variables)
            const classBodyMatch = cleanCode.match(/class\s+[A-Za-z0-9_]+[^{]*\{([\s\S]*)\}/);
            if (!classBodyMatch) {
                throw new Error('Could not extract class body');
            }
            
            const classBody = classBodyMatch[1];
            
            // Find all method bodies to exclude them when looking for fields
            const methodBodies = [];
            const methodBodyRegex = /\s*(private|public|protected)?(\s+(static|final|abstract))?\s+([A-Za-z0-9_<>]+)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{([\s\S]*?)(?:\n\s*\})/g;
            
            let methodBodyMatch;
            while ((methodBodyMatch = methodBodyRegex.exec(classBody)) !== null) {
                if (['if', 'else', 'for', 'while', 'switch', 'catch', 'try'].includes(methodBodyMatch[5])) {
                    continue;
                }
                
                const methodStart = classBody.indexOf(methodBodyMatch[0]);
                const methodEnd = methodStart + methodBodyMatch[0].length;
                
                methodBodies.push({
                    start: methodStart,
                    end: methodEnd,
                    body: methodBodyMatch[0]
                });
            }
            
            // Remove method bodies from class body to find class-level fields
            let classBodyWithoutMethods = classBody;
            // Process in reverse order to maintain correct indices
            methodBodies.sort((a, b) => b.start - a.start).forEach(method => {
                classBodyWithoutMethods = classBodyWithoutMethods.substring(0, method.start) + 
                                          ' '.repeat(method.body.length) + 
                                          classBodyWithoutMethods.substring(method.end);
            });
            
            // Extract fields (now only class-level ones, since method bodies are excluded)
            const fields = [];
            // This regex matches field declarations at the class level
            // Updated to better handle static keyword in non-access modifiers
            const fieldRegex = /\s*(private|public|protected)?(\s+(static|final))?(\s+(static|final))?\s+([A-Za-z0-9_<>]+)\s+([A-Za-z0-9_]+)(\s*=\s*[^;]+)?;/g;
            
            let fieldMatch;
            while ((fieldMatch = fieldRegex.exec(classBodyWithoutMethods)) !== null) {
                // Skip if this is a return statement incorrectly matched
                if (fieldMatch[6] === 'return') {
                    continue;
                }
                
                // Combine potential non-access modifiers from both capture groups
                let nonAccessMods = '';
                if (fieldMatch[3]) nonAccessMods += fieldMatch[3] + ' ';
                if (fieldMatch[5]) nonAccessMods += fieldMatch[5] + ' ';
                nonAccessMods = nonAccessMods.trim();
                
                fields.push({
                    accessModifier: fieldMatch[1] || 'public',
                    nonAccessModifier: nonAccessMods || '',
                    dataType: fieldMatch[6],
                    name: fieldMatch[7],
                    initialValue: fieldMatch[8] ? fieldMatch[8].replace('=', '').trim() : null
                });
            }
            
            // Extract methods
            const methods = [];
            const methodRegex = /(?:^|\n|\r)\s*(private|public|protected)?(\s+(static|final|abstract))?\s+([A-Za-z0-9_<>]+)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{?/g;
            
            let methodMatch;
            let methodIndex = 0;
            
            while ((methodMatch = methodRegex.exec(cleanCode)) !== null) {
                // Skip if it matches a control flow keyword
                if (['if', 'else', 'for', 'while', 'switch', 'catch', 'try'].includes(methodMatch[5])) {
                    continue;
                }
                
                // Parse parameters
                const params = methodMatch[6].split(',').map(param => {
                    if (!param.trim()) return null;
                    
                    const parts = param.trim().split(/\s+/);
                    return {
                        dataType: parts[0],
                        name: parts[1] || '_unnamed_'
                    };
                }).filter(p => p !== null);
                
                // Check if this is a constructor (has the same name as the class)
                const isConstructor = methodMatch[5] === className;
                
                methods.push({
                    id: methodIndex++,
                    accessModifier: methodMatch[1] || 'public',
                    nonAccessModifier: methodMatch[3] || '',
                    returnType: isConstructor ? 'constructor' : methodMatch[4],
                    name: methodMatch[5],
                    parameters: params,
                    isConstructor: isConstructor
                });
            }
            
            // Store the parsed class
            this.classes.push({
                name: className,
                extendsClass,
                implementsInterfaces,
                fields,
                methods
            });
            
            return {
                success: true,
                message: 'Code parsed successfully',
                classes: this.classes
            };
        } catch (error) {
            console.error('Error parsing Java code:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    /**
     * Remove comments from Java code
     * @param {string} code - Java code with comments
     * @returns {string} - Code without comments
     */
    removeComments(code) {
        // Remove single line comments
        let cleanCode = code.replace(/\/\/.*$/gm, '');
        
        // Remove multi-line comments
        cleanCode = cleanCode.replace(/\/\*[\s\S]*?\*\//g, '');
        
        return cleanCode;
    }
    
    /**
     * Parse Java files to extract class information
     * @param {File[]} files - Array of Java file objects
     * @returns {Promise<Object>} - Promise resolving to parsed class data
     */
    async parseFiles(files) {
        console.log('Parsing files for class diagram...');
        
        // Clear previous data
        this.classes = [];
        
        try {
            const filePromises = files.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    
                    reader.onload = (e) => {
                        const code = e.target.result;
                        try {
                            // Parse each file
                            const result = this.parseCode(code);
                            if (!result.success) {
                                console.warn(`Warning parsing ${file.name}: ${result.message}`);
                            }
                            resolve();
                        } catch (error) {
                            console.error(`Error parsing ${file.name}:`, error);
                            reject(error);
                        }
                    };
                    
                    reader.onerror = (error) => {
                        reject(new Error(`Error reading file ${file.name}: ${error}`));
                    };
                    
                    reader.readAsText(file);
                });
            });
            
            // Wait for all files to be parsed
            await Promise.all(filePromises);
            
            return {
                success: true,
                message: `Successfully parsed ${files.length} file(s)`,
                classes: this.classes
            };
        } catch (error) {
            console.error('Error parsing files:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    /**
     * Generate diagram from parsed data
     * @returns {Object} - Object containing diagram data/elements
     */
    generateDiagram() {
        console.log('Generating class diagram...');
        
        if (this.classes.length === 0) {
            return {
                elements: [],
                success: false,
                message: 'No classes found to generate diagram'
            };
        }
        
        try {
            // For now, we'll just prepare the data for rendering
            // In a more advanced implementation, this could generate SVG elements
            // or prepare data for a diagramming library
            
            // Find relationships between classes (inheritance, implementation)
            this.classes.forEach(classData => {
                if (classData.extendsClass) {
                    this.relationships.push({
                        type: 'inheritance',
                        from: classData.name,
                        to: classData.extendsClass
                    });
                }
                
                classData.implementsInterfaces.forEach(interfaceName => {
                    this.relationships.push({
                        type: 'implementation',
                        from: classData.name,
                        to: interfaceName
                    });
                });
                
                // Additional analysis could find associations between classes
                // by examining field types and method parameter/return types
            });
            
            return {
                elements: this.classes,
                relationships: this.relationships,
                success: true,
                message: `Generated diagram with ${this.classes.length} class(es)`
            };
        } catch (error) {
            console.error('Error generating class diagram:', error);
            return {
                elements: [],
                success: false,
                message: error.message
            };
        }
    }
    
    /**
     * Render diagram to a DOM element
     * @param {HTMLElement} container - DOM element to render the diagram into
     * @returns {Object} - Rendering result
     */
    renderDiagram(container) {
        console.log('Rendering class diagram...');
        
        if (this.classes.length === 0) {
            container.innerHTML = `
                <div style="text-align: center;">
                    <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                    <p>No classes found to display. Please check your Java code.</p>
                </div>
            `;
            return {
                success: false,
                message: 'No classes to render'
            };
        }
        
        try {
            // Clear the container
            container.innerHTML = '';
            
            // Create a container for all diagrams
            const diagramsContainer = document.createElement('div');
            diagramsContainer.className = 'class-diagrams';
            diagramsContainer.style.display = 'flex';
            diagramsContainer.style.flexWrap = 'wrap';
            diagramsContainer.style.gap = '20px';
            diagramsContainer.style.justifyContent = 'center';
            
            // Render each class
            this.classes.forEach(classData => {
                const classDiagram = document.createElement('div');
                classDiagram.className = 'class-diagram';
                classDiagram.style.width = '350px';
                classDiagram.style.border = '2px solid var(--primary-color)';
                classDiagram.style.borderRadius = 'var(--border-radius)';
                classDiagram.style.overflow = 'hidden';
                classDiagram.style.backgroundColor = 'var(--card-bg)';
                classDiagram.style.margin = '10px';
                
                // Class name section
                const classNameSection = document.createElement('div');
                classNameSection.className = 'class-name';
                classNameSection.style.backgroundColor = 'var(--primary-color)';
                classNameSection.style.color = 'white';
                classNameSection.style.padding = '10px';
                classNameSection.style.textAlign = 'center';
                classNameSection.style.fontWeight = 'bold';
                classNameSection.textContent = classData.name;
                
                // Variables section
                const variablesSection = document.createElement('div');
                variablesSection.className = 'variables-section';
                variablesSection.style.padding = '15px';
                variablesSection.style.borderBottom = '1px dashed var(--border-color)';
                
                // Variables header
                const variablesHeader = document.createElement('div');
                variablesHeader.style.fontWeight = 'bold';
                variablesHeader.style.marginBottom = '10px';
                variablesHeader.textContent = 'Variables';
                variablesSection.appendChild(variablesHeader);
                
                // List of variables
                if (classData.fields.length === 0) {
                    const noFields = document.createElement('div');
                    noFields.style.fontStyle = 'italic';
                    noFields.style.color = 'var(--text-muted)';
                    noFields.textContent = 'No variables';
                    variablesSection.appendChild(noFields);
                } else {
                    classData.fields.forEach(field => {
                        const fieldElement = document.createElement('div');
                        fieldElement.style.marginBottom = '5px';
                        
                        // Color coding for access modifiers
                        const accessModColor = this.getAccessModifierColor(field.accessModifier);
                        
                        fieldElement.innerHTML = `<span style="color: ${accessModColor}">${field.accessModifier}</span> ${field.nonAccessModifier ? field.nonAccessModifier + ' ' : ''}${field.dataType} ${field.name}`;
                        variablesSection.appendChild(fieldElement);
                    });
                }
                
                // Methods section
                const methodsSection = document.createElement('div');
                methodsSection.className = 'methods-section';
                methodsSection.style.padding = '15px';
                
                // Methods header
                const methodsHeader = document.createElement('div');
                methodsHeader.style.fontWeight = 'bold';
                methodsHeader.style.marginBottom = '10px';
                methodsHeader.textContent = 'Methods';
                methodsSection.appendChild(methodsHeader);
                
                // List of methods
                if (classData.methods.length === 0) {
                    const noMethods = document.createElement('div');
                    noMethods.style.fontStyle = 'italic';
                    noMethods.style.color = 'var(--text-muted)';
                    noMethods.textContent = 'No methods';
                    methodsSection.appendChild(noMethods);
                } else {
                    classData.methods.forEach(method => {
                        const methodElement = document.createElement('div');
                        methodElement.style.marginBottom = '8px';
                        
                        // Color coding for access modifiers
                        const accessModColor = this.getAccessModifierColor(method.accessModifier);
                        
                        // Format parameters
                        const params = method.parameters.map(param => `${param.dataType} ${param.name}`).join(', ');
                        
                        // For constructors, display differently to avoid duplication
                        if (method.isConstructor) {
                            methodElement.innerHTML = `<span style="color: ${accessModColor}">${method.accessModifier}</span> ${method.nonAccessModifier ? method.nonAccessModifier + ' ' : ''}${method.name}(${params})`;
                        } else {
                            methodElement.innerHTML = `<span style="color: ${accessModColor}">${method.accessModifier}</span> ${method.nonAccessModifier ? method.nonAccessModifier + ' ' : ''}${method.returnType} ${method.name}(${params})`;
                        }
                        methodsSection.appendChild(methodElement);
                    });
                }
                
                // Assemble the class diagram
                classDiagram.appendChild(classNameSection);
                classDiagram.appendChild(variablesSection);
                classDiagram.appendChild(methodsSection);
                
                // Add to the container
                diagramsContainer.appendChild(classDiagram);
            });
            
            // Add all diagrams to the main container
            container.appendChild(diagramsContainer);
            
            return {
                success: true,
                message: 'Diagram rendered successfully'
            };
        } catch (error) {
            console.error('Error rendering class diagram:', error);
            container.innerHTML = `
                <div style="text-align: center; color: var(--danger-color);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p>Error rendering diagram: ${error.message}</p>
                </div>
            `;
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    /**
     * Get color for different access modifiers
     * @param {string} accessModifier - The access modifier (private, public, protected)
     * @returns {string} - Color code
     */
    getAccessModifierColor(accessModifier) {
        switch (accessModifier.toLowerCase()) {
            case 'private':
                return '#e74c3c'; // Red
            case 'public':
                return '#2ecc71'; // Green
            case 'protected':
                return '#f39c12'; // Orange
            default:
                return 'var(--text-color)';
        }
    }
    
    /**
     * Export diagram as PNG
     * @returns {Promise<Object>} - Promise resolving to an object containing the PNG blob and additional info
     */
    async exportAsPNG() {
        console.log('Exporting class diagram as PNG...');

        // Find the diagram container
        const diagramContainer = document.querySelector('.class-diagrams');
        if (!diagramContainer) {
            console.log('Diagram container not found');
        }

        try {
            // Use html2canvas to capture the diagram container as a canvas
            const canvas = await html2canvas(diagramContainer);
            
            // Convert the canvas to a PNG blob
            return new Promise((resolve, reject) => {
                canvas.toBlob(blob => {
                    if (blob) {
                        // Create a temporary URL for the blob
                        const url = URL.createObjectURL(blob);
                        
                        // Create a temporary anchor element to trigger download
                        const downloadLink = document.createElement('a');
                        downloadLink.href = url;
                        downloadLink.download = 'class-diagram.png';
                        
                        // Append to body, click, and remove
                        document.body.appendChild(downloadLink);
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                        
                        // Revoke the URL to free up memory
                        URL.revokeObjectURL(url);
                        console.log('Diagram exported successfully');
                    } else {
                        console.log('Conversion to PNG blob failed');
                    }
                }, 'image/png');
            });
        } catch (error) {
            console.error('Error exporting class diagram:', error);
        }
    }
}

// Export the class for use in other scripts
window.ClassDiagramGenerator = ClassDiagramGenerator;