document.addEventListener('DOMContentLoaded', function() {
    // Initialize Mermaid with custom settings
    mermaid.initialize({
        startOnLoad: false,  // We'll manually initialize it
        theme: 'dark',
        securityLevel: 'loose',
        flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'linear',
            diagramPadding: 8
        },
        themeVariables: {
            primaryColor: '#3949ab',
            primaryTextColor: '#fff',
            primaryBorderColor: '#3949ab',
            lineColor: '#ffffff',
            secondaryColor: '#d32f2f',
            tertiaryColor: '#2a2a2a'
        },
        classDiagram: {
            useMaxWidth: true
        }
    });

    // DOM Elements
    const tabButtons = document.querySelectorAll('.tab-btn');
    const inputRadios = document.querySelectorAll('input[name="input-method"]');
    const pasteContainer = document.getElementById('paste-container');
    const uploadContainer = document.getElementById('upload-container');
    const javaCodeTextarea = document.getElementById('java-code');
    const fileUpload = document.getElementById('file-upload');
    const fileList = document.getElementById('file-list');
    const generateBtn = document.getElementById('generate-btn');
    const diagramOutput = document.getElementById('diagram-output');
    const downloadSvgBtn = document.getElementById('download-svg-btn');
    const downloadPngBtn = document.getElementById('download-png-btn');

    // Current state
    let currentTab = 'class-diagram';
    let uploadedFiles = [];

    // Event Listeners
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentTab = button.dataset.tab;
        });
    });

    inputRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'paste') {
                pasteContainer.style.display = 'block';
                uploadContainer.style.display = 'none';
            } else {
                pasteContainer.style.display = 'none';
                uploadContainer.style.display = 'block';
            }
        });
    });

    // Handle file uploads
    fileUpload.addEventListener('change', handleFileUpload);

    generateBtn.addEventListener('click', generateDiagram);
    
    if (downloadSvgBtn) {
        downloadSvgBtn.addEventListener('click', () => downloadDiagram('svg'));
    }
    
    if (downloadPngBtn) {
        downloadPngBtn.addEventListener('click', () => downloadDiagram('png'));
    }

    // File upload handler
    function handleFileUpload(event) {
        const files = event.target.files;
        
        if (files.length > 0) {
            Array.from(files).forEach(file => {
                if (file.name.endsWith('.java')) {
                    // Read file content
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const fileContent = e.target.result;
                        
                        // Add to uploadedFiles array
                        uploadedFiles.push({
                            name: file.name,
                            content: fileContent
                        });
                        
                        // Update file list UI
                        updateFileList();
                    };
                    reader.readAsText(file);
                }
            });
        }
    }

    // Update the file list display
    function updateFileList() {
        // Clear existing list
        fileList.innerHTML = '';
        
        // Add each file to the list
        uploadedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const fileName = document.createElement('div');
            fileName.className = 'file-item-name';
            fileName.innerHTML = `<i class="fas fa-file-code"></i> ${file.name}`;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'file-item-remove';
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.addEventListener('click', () => {
                uploadedFiles.splice(index, 1);
                updateFileList();
            });
            
            fileItem.appendChild(fileName);
            fileItem.appendChild(removeBtn);
            fileList.appendChild(fileItem);
        });
    }

    // Functions
    function generateDiagram() {
        let javaCode = '';
        
        // Get code based on selected input method
        const isPasteMethod = document.querySelector('input[name="input-method"]:checked').value === 'paste';
        
        if (isPasteMethod) {
            javaCode = javaCodeTextarea.value.trim();
            
            if (!javaCode) {
                alert('Please enter Java code or upload a file.');
                return;
            }
        } else {
            if (uploadedFiles.length === 0) {
                alert('Please upload at least one Java file.');
                return;
            }
            
            // Concatenate all file contents (for flowcharts, we'll use the first file)
            if (currentTab === 'class-diagram') {
                // For class diagrams, we'll analyze all files together
                javaCode = uploadedFiles.map(file => file.content).join('\n\n');
            } else {
                // For flowcharts, just use the first file
                javaCode = uploadedFiles[0].content;
            }
        }

        // Preprocess: remove import statements so that only the relevant code is processed
        javaCode = javaCode.replace(/import\s+.*;/g, '');

        try {
            let mermaidCode;
            
            if (currentTab === 'class-diagram') {
                mermaidCode = generateClassDiagram(javaCode);
            } else {
                mermaidCode = generateFlowchart(javaCode);
            }

            diagramOutput.innerHTML = `<div class="mermaid">${mermaidCode}</div>`;
            
            // Initialize Mermaid with error handling
            try {
                mermaid.init(undefined, document.querySelectorAll('.mermaid'));
                
                // Add syntax highlighting classes
                applyCustomStyling();
                
                // Only enable download buttons if diagram was successfully generated
                if (diagramOutput.querySelector('svg')) {
                    if (downloadSvgBtn) downloadSvgBtn.disabled = false;
                    if (downloadPngBtn) downloadPngBtn.disabled = false;
                } else {
                    throw new Error("SVG diagram was not created");
                }
            } catch (mermaidError) {
                console.error("Mermaid error:", mermaidError);
                handleError("Mermaid diagram generation failed", mermaidError);
            }
        } catch (error) {
            console.error("Generation error:", error);
            handleError("Error generating diagram", error);
        }
    }

    function generateClassDiagram(javaCode) {
        // Split multiple files by looking for class declarations
        const files = getFileSections(javaCode);
        
        // Create a more structured class diagram
        let mermaidCode = 'classDiagram\n';
        let processedClasses = [];
        
        // Process each file
        for (const file of files) {
            const fileContent = file.content;
            
            // Extract class name
            const classNameMatch = fileContent.match(/class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/);
            if (!classNameMatch) continue;
            
            const className = classNameMatch[1];
            const parentClass = classNameMatch[2] || null;
            
            // Skip if already processed
            if (processedClasses.includes(className)) continue;
            processedClasses.push(className);
            
            // Add class to diagram
            mermaidCode += `    class ${className} {\n`;
            
            // Find and add variables section
            const variables = extractVariables(fileContent);
            if (variables.length > 0) {
                mermaidCode += `        Variables\n`;
                for (const variable of variables) {
                    mermaidCode += `        ${variable.type} ${variable.name}\n`;
                }
            } else {
                mermaidCode += `        No variables\n`;
            }
            
            // Find and add methods section
            const methods = extractMethods(fileContent);
            if (methods.length > 0) {
                mermaidCode += `        Methods\n`;
                for (const method of methods) {
                    mermaidCode += `        ${method.accessModifier} ${method.returnType} ${method.name}(${method.params})\n`;
                    
                    // Add conditional statements if present
                    const conditionals = extractConditionals(method.body);
                    for (const cond of conditionals) {
                        mermaidCode += `        ${cond}\n`;
                    }
                }
            }
            
            mermaidCode += `    }\n`;
            
            // Add inheritance if exists
            if (parentClass) {
                mermaidCode += `    ${className} --|> ${parentClass}\n`;
            }
            
            // Add relationships with other classes
            const relationships = findRelationships(fileContent, className, processedClasses);
            for (const rel of relationships) {
                mermaidCode += `    ${rel}\n`;
            }
        }
        
        // Add custom styling directives
        mermaidCode += `    
    classDef default fill:#2d2d2d,stroke:#5a7cb6,color:white
    classDef header fill:#5a7cb6,stroke:#5a7cb6,color:white
    `;
        
        return mermaidCode;
    }
    
    // Helper function to split code into file sections
    function getFileSections(javaCode) {
        // If multiple files were uploaded, they're already separate
        if (uploadedFiles.length > 1) {
            return uploadedFiles;
        }
        
        // Otherwise try to identify individual classes in the pasted code
        const fileSections = [];
        const classMatches = javaCode.matchAll(/(?:public|private|protected)?\s*class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?\s*{/g);
        
        let lastIndex = 0;
        let fileName = "Unknown.java";
        
        for (const match of classMatches) {
            const className = match[1];
            const startIndex = match.index;
            
            // If this isn't the first class, add the previous one
            if (lastIndex > 0) {
                const content = javaCode.substring(lastIndex, startIndex);
                fileSections.push({
                    name: fileName,
                    content: content
                });
            }
            
            lastIndex = startIndex;
            fileName = `${className}.java`;
        }
        
        // Add the last section
        if (lastIndex < javaCode.length) {
            fileSections.push({
                name: fileName,
                content: javaCode.substring(lastIndex)
            });
        }
        
        // If no sections were found, treat it as a single file
        if (fileSections.length === 0) {
            fileSections.push({
                name: "Unknown.java",
                content: javaCode
            });
        }
        
        return fileSections;
    }
    
    // Extract variables from class code
    function extractVariables(classCode) {
        const variables = [];
        const variableRegex = /(private|public|protected)\s+(?:final\s+)?(\w+(?:<[\w<>,\s]+>)?)\s+(\w+)(?:\s*=\s*[^;]+)?;/g;
        
        let match;
        while ((match = variableRegex.exec(classCode)) !== null) {
            const accessModifier = match[1];
            const type = match[2];
            const name = match[3];
            
            variables.push({
                accessModifier: accessModifier,
                type: type,
                name: name
            });
        }
        
        return variables;
    }
    
    // Extract methods from class code
    function extractMethods(classCode) {
        const methods = [];
        // Match method declarations, including their body
        const methodRegex = /(private|public|protected)\s+(?:static\s+)?(\w+(?:<[\w<>,\s]+>)?)\s+(\w+)\s*\(([^)]*)\)\s*{([^}]*(?:{[^}]*}[^}]*)*)}/g;
        
        let match;
        while ((match = methodRegex.exec(classCode)) !== null) {
            const accessModifier = match[1];
            const returnType = match[2];
            const name = match[3];
            const params = match[4];
            const body = match[5] || '';
            
            methods.push({
                accessModifier: accessModifier,
                returnType: returnType,
                name: name,
                params: params,
                body: body
            });
        }
        
        return methods;
    }
    
    // Extract conditional statements like if/else
    function extractConditionals(methodBody) {
        const conditionals = [];
        
        // Match if and else if statements
        const ifRegex = /(?:else\s+)?if\s*\(([^)]+)\)/g;
        
        let match;
        while ((match = ifRegex.exec(methodBody)) !== null) {
            const condition = match[1].trim();
            conditionals.push(`${match[0].includes('else') ? 'else if' : 'if'}(${condition})`);
        }
        
        // Match standalone else statements
        const elseRegex = /else\s*{/g;
        while ((match = elseRegex.exec(methodBody)) !== null) {
            conditionals.push('else');
        }
        
        return conditionals;
    }
    
    // Find relationships between classes
    function findRelationships(classCode, className, otherClasses) {
        const relationships = [];
        
        // Look for instance declarations of other classes
        for (const otherClass of otherClasses) {
            if (otherClass === className) continue;
            
            const instanceRegex = new RegExp(`${otherClass}\\s+\\w+\\s*=`, 'g');
            if (instanceRegex.test(classCode)) {
                relationships.push(`${className} --> ${otherClass} : uses`);
            }
        }
        
        return relationships;
    }

    function generateFlowchart(javaCode) {
        // Find class and method declarations
        const classRegex = /class\s+(\w+)/g;
        const methodRegex = /(?:public|private|protected)(?:\s+static)?\s+(\w+)\s+(\w+)\s*\(([^)]*)\)/g;
        let flowchart = 'flowchart TD\n';
        
        // Add class declaration
        let className = "Unknown";
        let classMatch = classRegex.exec(javaCode);
        if (classMatch) {
            className = classMatch[1];
            flowchart += `    class[public class ${className}]\n`;
            flowchart += `    class:::classStyle\n`;
        }
        
        // Find main method
        methodRegex.lastIndex = 0;
        let methodMatch;
        while ((methodMatch = methodRegex.exec(javaCode)) !== null) {
            const returnType = methodMatch[1];
            const methodName = methodMatch[2];
            const params = methodMatch[3];
            
            if (methodName === "main") {
                // Fixed: Add main method node with complete label
                flowchart += `    class --> mainSig[public static void main(String[] args)]\n`;
                flowchart += `    mainSig:::codeStyle\n`;
                
                // Extract method body
                const methodBodyRegex = new RegExp(`${methodName}\\s*\\([^)]*\\)\\s*{([^}]*(?:{[^}]*})*[^}]*)}`, 'gs');
                const bodyMatch = methodBodyRegex.exec(javaCode);
                
                if (bodyMatch) {
                    const body = bodyMatch[1];
                    
                    // Parse for loops specifically for nested loops like in the example
                    const forLoopRegex = /for\s*\(([^;]+);([^;]+);([^)]+)\)(?:\s*{)?([^}]*(?:{[^}]*})*[^}]*)?(?:})?/gs;
                    let outerLoopMatch = forLoopRegex.exec(body);
                    
                    if (outerLoopMatch) {
                        const outerInit = outerLoopMatch[1].trim();
                        const outerCond = outerLoopMatch[2].trim();
                        const outerIncr = outerLoopMatch[3].trim();
                        const outerBody = outerLoopMatch[4] || '';
                        
                        // Outer loop initialization
                        flowchart += `    mainSig --> outerInit[${outerInit}]\n`;
                        flowchart += `    outerInit:::codeStyle\n`;
                        
                        // Outer loop condition
                        flowchart += `    outerInit --> outerCond{${outerCond}}\n`;
                        flowchart += `    outerCond:::conditionStyle\n`;
                        
                        // Find nested loop
                        forLoopRegex.lastIndex = 0; // Reset regex to search in the outer loop body
                        let innerLoopMatch = forLoopRegex.exec(outerBody);
                        
                        if (innerLoopMatch) {
                            const innerInit = innerLoopMatch[1].trim();
                            const innerCond = innerLoopMatch[2].trim();
                            const innerIncr = innerLoopMatch[3].trim();
                            const innerBody = innerLoopMatch[4] || '';
                            
                            // Inner loop initialization (when outer loop condition is true)
                            flowchart += `    outerCond -->|True| innerInit[${innerInit}]\n`;
                            flowchart += `    innerInit:::codeStyle\n`;
                            
                            // Inner loop condition
                            flowchart += `    innerInit --> innerCond{${innerCond}}\n`;
                            flowchart += `    innerCond:::conditionStyle\n`;
                            
                            // Find print statements in inner loop
                            const printRegex = /System\.out\.println\s*\((.*?)\)/g;
                            let printMatch = printRegex.exec(innerBody);
                            
                            if (printMatch) {
                                // Print statement (when inner loop condition is true)
                                flowchart += `    innerCond -->|True| print[System.out.println(${printMatch[1]})]\n`;
                                flowchart += `    print:::codeStyle\n`;
                                
                                // Inner loop increment
                                flowchart += `    print --> innerIncr[${innerIncr}]\n`;
                                flowchart += `    innerIncr:::codeStyle\n`;
                                
                                // Back to inner condition
                                flowchart += `    innerIncr --> innerCond\n`;
                            } else {
                                // Generic inner loop body
                                flowchart += `    innerCond -->|True| innerBody[Inner Loop Body]\n`;
                                flowchart += `    innerBody:::codeStyle\n`;
                                flowchart += `    innerBody --> innerIncr[${innerIncr}]\n`;
                                flowchart += `    innerIncr:::codeStyle\n`;
                                flowchart += `    innerIncr --> innerCond\n`;
                            }
                            
                            // Exit inner loop to outer loop increment
                            flowchart += `    innerCond -->|False| outerIncr[${outerIncr}]\n`;
                            flowchart += `    outerIncr:::codeStyle\n`;
                            
                            // Back to outer condition
                            flowchart += `    outerIncr --> outerCond\n`;
                        } else {
                            // Simple outer loop without nesting
                            flowchart += `    outerCond -->|True| outerBody[Loop Body]\n`;
                            flowchart += `    outerBody:::codeStyle\n`;
                            flowchart += `    outerBody --> outerIncr[${outerIncr}]\n`;
                            flowchart += `    outerIncr:::codeStyle\n`;
                            flowchart += `    outerIncr --> outerCond\n`;
                        }
                        
                        // Exit outer loop
                        flowchart += `    outerCond -->|False| exit[Exit Loop]\n`;
                        flowchart += `    exit:::codeStyle\n`;
                    }
                }
            }
        }
        
        // Add style definitions to match the image
        flowchart += `\n    classDef classStyle fill:#d32d2d,stroke:#5a7cb6,color:white\n`;
        flowchart += `    classDef conditionStyle fill:#d32f2f,stroke:#d32f2f,color:white,shape:diamond\n`;
        flowchart += `    classDef codeStyle fill:#3949ab,stroke:#3949ab,color:white\n`;
        
        return flowchart;
    }

    // Add custom styling to the generated diagram
    function applyCustomStyling() {
        if (!diagramOutput.querySelector('svg')) return;
        
        // Apply custom styling to class diagrams
        if (currentTab === 'class-diagram') {
            // Apply styling to class diagram elements
            const classTitles = diagramOutput.querySelectorAll('.classTitle');
            classTitles.forEach(title => {
                title.parentElement.classList.add('title-section');
            });
            
            // Style variable and method text for syntax highlighting
            const classSections = diagramOutput.querySelectorAll('.section');
            classSections.forEach(section => {
                const text = section.querySelector('text');
                if (text) {
                    const content = text.textContent;
                    
                    // Apply syntax highlighting based on content
                    if (content.includes('String') || content.includes('int') || content.includes('boolean')) {
                        const formattedContent = content.replace(
                            /(String|int|char|boolean|double|float|void|static)/g, 
                            '<tspan class="type">$1</tspan>'
                        );
                        text.innerHTML = formattedContent;
                    }
                    
                    if (content.includes('public') || content.includes('private') || content.includes('protected')) {
                        const formattedContent = text.innerHTML.replace(
                            /(public|private|protected|if|else)/g, 
                            '<tspan class="keyword">$1</tspan>'
                        );
                        text.innerHTML = formattedContent;
                    }
                }
            });
        }
    }

    function downloadDiagram(format) {
        const svgElement = diagramOutput.querySelector('svg');
        if (!svgElement) {
            alert('No diagram available to download. Please generate a diagram first.');
            return;
        }
        
        if (format === 'svg') {
            // SVG Download
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const blob = new Blob([svgData], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentTab}-diagram.svg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else if (format === 'png') {
            // PNG Download
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // Set canvas dimensions
            const svgWidth = svgElement.viewBox.baseVal.width || svgElement.width.baseVal.value;
            const svgHeight = svgElement.viewBox.baseVal.height || svgElement.height.baseVal.value;
            const scale = 2; // Scale for better quality
            
            canvas.width = svgWidth * scale;
            canvas.height = svgHeight * scale;
            context.scale(scale, scale);
            
            // Create image from SVG
            const img = new Image();
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
            const url = URL.createObjectURL(svgBlob);
            
            img.onload = function() {
                // Draw image to canvas
                context.fillStyle = '#1e1e1e'; // Match background color
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.drawImage(img, 0, 0, svgWidth, svgHeight);
                
                // Convert canvas to PNG and download
                try {
                    canvas.toBlob(function(blob) {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${currentTab}-diagram.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 'image/png');
                } catch (e) {
                    console.error('Error creating PNG:', e);
                    alert('Failed to create PNG. Try using SVG format instead.');
                }
            };
            
            img.onerror = function() {
                console.error('Error loading SVG');
                alert('Failed to create PNG. Try using SVG format instead.');
            };
            
            img.src = url;
        }
    }

    // Error handling function
    function handleError(message, error) {
        console.error(message, error);
        diagramOutput.innerHTML = `<div class="error-message">${message}: ${error.message}</div>`;
        
        // Safely disable buttons
        if (downloadSvgBtn) downloadSvgBtn.disabled = true;
        if (downloadPngBtn) downloadPngBtn.disabled = true;
    }

    // Initialize UI
    function initializeUI() {
        // Add initial example code to help users get started
        javaCodeTextarea.value = `public class Main {
    public static void main(String[] args) {
        // Create a new student
        Student student = new Student();
        student.name = "John Doe";
        student.course = "Computer Science";
        student.numericalScore = 85;
        student.printGrade();
    }
}

class Student {
    String name;
    String course;
    int numericalScore;
    char grade;
    
    public void printGrade() {
        if (numericalScore >= 80) {
            grade = 'A';
        } else if (numericalScore >= 70) {
            grade = 'B';
        } else if (numericalScore >= 60) {
            grade = 'C';
        } else {
            grade = 'F';
        }
        System.out.println(name + " got a " + grade + " in " + course);
    }
}`;
        
        // Make sure download buttons are disabled initially
        if (downloadSvgBtn) downloadSvgBtn.disabled = true;
        if (downloadPngBtn) downloadPngBtn.disabled = true;
    }

    // Initialize UI safely
    try {
        initializeUI();
    } catch (error) {
        handleError("Failed to initialize UI", error);
    }
});
