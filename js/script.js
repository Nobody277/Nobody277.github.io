document.addEventListener('DOMContentLoaded', function() {
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
    
    if (downloadPngBtn) {
        downloadPngBtn.addEventListener('click', downloadDiagram);
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

    // Main function to generate diagrams
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

        try {
            diagramOutput.innerHTML = '';
            
            if (currentTab === 'class-diagram') {
                generateCustomClassDiagram(javaCode);
            } else {
                generateCustomFlowchart(javaCode);
            }
            
            // Enable download button
            if (downloadPngBtn) downloadPngBtn.disabled = false;
            
        } catch (error) {
            console.error("Generation error:", error);
            handleError("Error generating diagram", error);
        }
    }

    // Generate custom class diagram
    function generateCustomClassDiagram(javaCode) {
        // Create diagram container
        const container = document.createElement('div');
        container.className = 'diagram-container';
        
        // Extract file sections
        const files = getFileSections(javaCode);
        
        for (const file of files) {
            const fileContent = file.content;
            const className = extractClassName(fileContent);
            
            if (!className) continue;
            
            // Create class box
            const classBox = document.createElement('div');
            classBox.className = 'class-box';
            
            // Add class header
            const classHeader = document.createElement('div');
            classHeader.className = 'class-header';
            classHeader.textContent = file.name.replace('.java', '');
            classBox.appendChild(classHeader);
            
            // Add variables section
            const variablesSection = document.createElement('div');
            variablesSection.className = 'class-section';
            
            const variablesTitle = document.createElement('div');
            variablesTitle.className = 'section-title';
            variablesTitle.textContent = 'Variables';
            variablesSection.appendChild(variablesTitle);
            
            const variables = extractVariables(fileContent);
            
            if (variables.length > 0) {
                variables.forEach(variable => {
                    const variableItem = document.createElement('div');
                    variableItem.className = 'variable-item';
                    
                    // Add syntax highlighting
                    variableItem.innerHTML = `
                        <span class="type">${variable.type}</span> 
                        <span class="name">${variable.name}</span>
                    `;
                    
                    variablesSection.appendChild(variableItem);
                });
            } else {
                const noVars = document.createElement('div');
                noVars.className = 'variable-item';
                noVars.textContent = 'No variables';
                variablesSection.appendChild(noVars);
            }
            
            classBox.appendChild(variablesSection);
            
            // Add methods section
            const methodsSection = document.createElement('div');
            methodsSection.className = 'class-section';
            
            const methodsTitle = document.createElement('div');
            methodsTitle.className = 'section-title';
            methodsTitle.textContent = 'Methods';
            methodsSection.appendChild(methodsTitle);
            
            const methods = extractMethods(fileContent);
            
            if (methods.length > 0) {
                methods.forEach(method => {
                    const methodItem = document.createElement('div');
                    methodItem.className = 'method-item';
                    
                    // Add syntax highlighting for method
                    methodItem.innerHTML = `
                        <span class="keyword">${method.accessModifier}</span> 
                        ${method.isStatic ? '<span class="keyword">static</span> ' : ''}
                        <span class="type">${method.returnType}</span> 
                        <span class="name">${method.name}</span>()
                    `;
                    
                    // Add conditionals if any
                    if (method.conditionals && method.conditionals.length > 0) {
                        method.conditionals.forEach(cond => {
                            const condItem = document.createElement('div');
                            condItem.className = 'method-item';
                            condItem.innerHTML = `&nbsp;&nbsp;<span class="keyword">${cond}</span>`;
                            methodsSection.appendChild(condItem);
                        });
                    }
                    
                    methodsSection.appendChild(methodItem);
                });
            } else {
                const noMethods = document.createElement('div');
                noMethods.className = 'method-item';
                noMethods.textContent = 'No methods';
                methodsSection.appendChild(noMethods);
            }
            
            classBox.appendChild(methodsSection);
            container.appendChild(classBox);
        }
        
        diagramOutput.appendChild(container);
    }
    
    // Extract class name from Java code
    function extractClassName(javaCode) {
        const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/;
        const match = javaCode.match(classRegex);
        return match ? match[1] : null;
    }
    
    // Extract variables from Java code
    function extractVariables(javaCode) {
        const variables = [];
        const variableRegex = /(?:private|public|protected)?\s*(?:static)?\s*(\w+(?:<[\w<>,\s]+>)?)\s+(\w+)(?:\s*=\s*[^;]+)?;/g;
        
        let match;
        while ((match = variableRegex.exec(javaCode)) !== null) {
            variables.push({
                type: match[1],
                name: match[2]
            });
        }
        
        return variables;
    }
    
    // Extract methods from Java code
    function extractMethods(javaCode) {
        const methods = [];
        // Match method declarations with basic modifiers
        const methodRegex = /(public|private|protected)?\s*(static)?\s*(\w+(?:<[\w<>,\s]+>)?)\s+(\w+)\s*\([^)]*\)\s*{/g;
        
        let match;
        while ((match = methodRegex.exec(javaCode)) !== null) {
            const accessModifier = match[1] || 'default';
            const isStatic = match[2] ? true : false;
            const returnType = match[3];
            const name = match[4];
            
            // Find method body to extract conditionals
            const methodBodyRegex = new RegExp(`${name}\\s*\\([^)]*\\)\\s*{([^}]*)}`, 's');
            const bodyMatch = methodBodyRegex.exec(javaCode);
            
            let conditionals = [];
            if (bodyMatch) {
                const body = bodyMatch[1];
                // Match if, else if, and else statements
                const ifElseRegex = /(else\s+if|if|else)\s*(?:\(([^)]+)\))?/g;
                
                let condMatch;
                while ((condMatch = ifElseRegex.exec(body)) !== null) {
                    if (condMatch[2]) {
                        conditionals.push(`${condMatch[1]}(${condMatch[2]})`);
                    } else {
                        conditionals.push(condMatch[1]);
                    }
                }
            }
            
            methods.push({
                accessModifier,
                isStatic,
                returnType,
                name,
                conditionals
            });
        }
        
        return methods;
    }
    
    // Helper function to split code into file sections
    function getFileSections(javaCode) {
        // If multiple files were uploaded, they're already separate
        if (uploadedFiles.length > 1) {
            return uploadedFiles;
        }
        
        // Otherwise try to identify individual classes in the pasted code
        const fileSections = [];
        const classRegex = /class\s+(\w+)/g;
        let classMatch;
        
        // Extract class names
        const classNames = [];
        while ((classMatch = classRegex.exec(javaCode)) !== null) {
            classNames.push(classMatch[1]);
        }
        
        if (classNames.length > 1) {
            // Multiple classes in one file - try to split them
            const classBoundaryRegex = /public\s+class\s+(\w+)|class\s+(\w+)/g;
            let lastIndex = 0;
            let boundaryMatch;
            
            while ((boundaryMatch = classBoundaryRegex.exec(javaCode)) !== null) {
                const className = boundaryMatch[1] || boundaryMatch[2];
                const startIndex = boundaryMatch.index;
                
                // If this isn't the first class, add the previous one
                if (lastIndex > 0) {
                    const content = javaCode.substring(lastIndex, startIndex);
                    const previousClass = extractClassName(content);
                    fileSections.push({
                        name: `${previousClass}.java`,
                        content: content
                    });
                }
                
                lastIndex = startIndex;
            }
            
            // Add the last class
            if (lastIndex < javaCode.length) {
                const content = javaCode.substring(lastIndex);
                const className = extractClassName(content);
                fileSections.push({
                    name: `${className}.java`,
                    content: content
                });
            }
        } else {
            // Just one class
            fileSections.push({
                name: `${classNames[0] || 'Unknown'}.java`,
                content: javaCode
            });
        }
        
        return fileSections;
    }

    // Generate custom flowchart
    function generateCustomFlowchart(javaCode) {
        // Create flowchart container
        const container = document.createElement('div');
        container.className = 'flowchart-container';
        
        // Extract class and method
        const className = extractClassName(javaCode);
        
        if (!className) {
            handleError("Error", { message: "No class found in the code" });
            return;
        }
        
        // Add class node
        const classNode = document.createElement('div');
        classNode.className = 'flowchart-node flowchart-class';
        classNode.textContent = `public class ${className}`;
        container.appendChild(classNode);
        
        // Add connector
        const connector1 = document.createElement('div');
        connector1.className = 'flowchart-connector';
        container.appendChild(connector1);
        
        // Extract main method
        const mainMethodRegex = /public\s+static\s+void\s+main\s*\(\s*String\s*\[\]\s*\w+\s*\)\s*{([^}]*)}/s;
        const mainMatch = javaCode.match(mainMethodRegex);
        
        if (mainMatch) {
            // Add main method signature
            const mainNode = document.createElement('div');
            mainNode.className = 'flowchart-node flowchart-process';
            mainNode.textContent = 'public static void main(String';
            container.appendChild(mainNode);
            
            // Add connector
            const connector2 = document.createElement('div');
            connector2.className = 'flowchart-connector';
            container.appendChild(connector2);
            
            // Add args
            const argsNode = document.createElement('div');
            argsNode.className = 'flowchart-node flowchart-process';
            argsNode.textContent = 'args)';
            container.appendChild(argsNode);
            
            // Parse for loops
            const mainBody = mainMatch[1];
            const forLoopRegex = /for\s*\(([^;]+);([^;]+);([^)]+)\)/g;
            let forMatch;
            
            if ((forMatch = forLoopRegex.exec(mainBody)) !== null) {
                const initExpr = forMatch[1].trim();
                const condExpr = forMatch[2].trim();
                const incrExpr = forMatch[3].trim();
                
                // Add connector
                const connector3 = document.createElement('div');
                connector3.className = 'flowchart-connector';
                container.appendChild(connector3);
                
                // Add initialization
                const initNode = document.createElement('div');
                initNode.className = 'flowchart-node flowchart-process';
                initNode.textContent = initExpr;
                container.appendChild(initNode);
                
                // Add connector
                const connector4 = document.createElement('div');
                connector4.className = 'flowchart-connector';
                container.appendChild(connector4);
                
                // Add condition diamond
                const condContainer = document.createElement('div');
                condContainer.className = 'flowchart-node flowchart-condition';
                
                const condText = document.createElement('div');
                condText.className = 'flowchart-condition-text';
                condText.textContent = condExpr;
                condContainer.appendChild(condText);
                
                container.appendChild(condContainer);
                
                // Check for nested loop
                const nestedForRegex = /for\s*\(([^;]+);([^;]+);([^)]+)\)/g;
                let nestedMatch;
                
                if (mainBody.match(/for\s*\([^)]+\)[^{]*{[^}]*for/s)) {
                    // Reset the regex
                    nestedForRegex.lastIndex = forMatch.index + forMatch[0].length;
                    
                    if ((nestedMatch = nestedForRegex.exec(mainBody)) !== null) {
                        const nestedInit = nestedMatch[1].trim();
                        const nestedCond = nestedMatch[2].trim();
                        const nestedIncr = nestedMatch[3].trim();
                        
                        // Create branches
                        const branchDiv = document.createElement('div');
                        branchDiv.className = 'flowchart-branch';
                        
                        // True branch (nested loop)
                        const trueConnector = document.createElement('div');
                        trueConnector.className = 'flowchart-connector';
                        
                        // True branch label
                        const trueLabelDiv = document.createElement('div');
                        trueLabelDiv.className = 'flowchart-branch-label flowchart-branch-true';
                        trueLabelDiv.textContent = 'True';
                        branchDiv.appendChild(trueLabelDiv);
                        
                        const nestedInitNode = document.createElement('div');
                        nestedInitNode.className = 'flowchart-node flowchart-process';
                        nestedInitNode.textContent = nestedInit;
                        
                        const nestedInitContainer = document.createElement('div');
                        nestedInitContainer.appendChild(trueConnector);
                        nestedInitContainer.appendChild(nestedInitNode);
                        branchDiv.appendChild(nestedInitContainer);
                        
                        // Connector to outer loop increment
                        const falseConnector = document.createElement('div');
                        falseConnector.className = 'flowchart-connector';
                        
                        // False branch label
                        const falseLabelDiv = document.createElement('div');
                        falseLabelDiv.className = 'flowchart-branch-label flowchart-branch-false';
                        falseLabelDiv.textContent = 'False';
                        branchDiv.appendChild(falseLabelDiv);
                        
                        const incrNode = document.createElement('div');
                        incrNode.className = 'flowchart-node flowchart-process';
                        incrNode.textContent = incrExpr;
                        
                        const incrContainer = document.createElement('div');
                        incrContainer.appendChild(falseConnector);
                        incrContainer.appendChild(incrNode);
                        branchDiv.appendChild(incrContainer);
                        
                        // Add horizontal connector
                        const horizontalConnector = document.createElement('div');
                        horizontalConnector.className = 'flowchart-connector-horizontal';
                        branchDiv.appendChild(horizontalConnector);
                        
                        container.appendChild(branchDiv);
                        
                        // Add connector from nested init to nested cond
                        const nestedConnector1 = document.createElement('div');
                        nestedConnector1.className = 'flowchart-connector';
                        nestedInitContainer.appendChild(nestedConnector1);
                        
                        // Add nested condition
                        const nestedCondContainer = document.createElement('div');
                        nestedCondContainer.className = 'flowchart-node flowchart-condition';
                        
                        const nestedCondText = document.createElement('div');
                        nestedCondText.className = 'flowchart-condition-text';
                        nestedCondText.textContent = nestedCond;
                        nestedCondContainer.appendChild(nestedCondText);
                        
                        nestedInitContainer.appendChild(nestedCondContainer);
                        
                        // Extract print statement if any
                        const printRegex = /System\.out\.println\s*\(([^)]+)\)/;
                        const printMatch = mainBody.match(printRegex);
                        
                        if (printMatch) {
                            // Create branches for nested condition
                            const nestedBranchDiv = document.createElement('div');
                            nestedBranchDiv.className = 'flowchart-branch';
                            
                            // True branch - print statement
                            const printConnector = document.createElement('div');
                            printConnector.className = 'flowchart-connector';
                            
                            // True branch label
                            const printLabelDiv = document.createElement('div');
                            printLabelDiv.className = 'flowchart-branch-label flowchart-branch-true';
                            printLabelDiv.textContent = 'True';
                            nestedBranchDiv.appendChild(printLabelDiv);
                            
                            const printNode = document.createElement('div');
                            printNode.className = 'flowchart-node flowchart-process';
                            printNode.textContent = `System.out.println(${printMatch[1]})`;
                            
                            const printContainer = document.createElement('div');
                            printContainer.appendChild(printConnector);
                            printContainer.appendChild(printNode);
                            nestedBranchDiv.appendChild(printContainer);
                            
                            // False branch - back to outer loop
                            const exitConnector = document.createElement('div');
                            exitConnector.className = 'flowchart-connector';
                            
                            // False branch label
                            const exitLabelDiv = document.createElement('div');
                            exitLabelDiv.className = 'flowchart-branch-label flowchart-branch-false';
                            exitLabelDiv.textContent = 'False';
                            nestedBranchDiv.appendChild(exitLabelDiv);
                            
                            const exitNode = document.createElement('div');
                            exitNode.className = 'flowchart-node flowchart-process';
                            exitNode.textContent = nestedIncr;
                            
                            const exitContainer = document.createElement('div');
                            exitContainer.appendChild(exitConnector);
                            exitContainer.appendChild(exitNode);
                            nestedBranchDiv.appendChild(exitContainer);
                            
                            nestedInitContainer.appendChild(nestedBranchDiv);
                        }
                    }
                } else {
                    // Simple for loop without nesting
                    // Create branches
                    const branchDiv = document.createElement('div');
                    branchDiv.className = 'flowchart-branch';
                    
                    // True branch
                    const trueConnector = document.createElement('div');
                    trueConnector.className = 'flowchart-connector';
                    
                    const loopBodyNode = document.createElement('div');
                    loopBodyNode.className = 'flowchart-node flowchart-process';
                    loopBodyNode.textContent = 'Loop Body';
                    
                    const trueContainer = document.createElement('div');
                    trueContainer.appendChild(trueConnector);
                    trueContainer.appendChild(loopBodyNode);
                    branchDiv.appendChild(trueContainer);
                    
                    // False branch
                    const falseConnector = document.createElement('div');
                    falseConnector.className = 'flowchart-connector';
                    
                    const exitNode = document.createElement('div');
                    exitNode.className = 'flowchart-node flowchart-process';
                    exitNode.textContent = 'Exit Loop';
                    
                    const falseContainer = document.createElement('div');
                    falseContainer.appendChild(falseConnector);
                    falseContainer.appendChild(exitNode);
                    branchDiv.appendChild(falseContainer);
                    
                    container.appendChild(branchDiv);
                }
            }
        }
        
        diagramOutput.appendChild(container);
    }

    function downloadDiagram() {
        if (!diagramOutput.firstChild) {
            alert('No diagram available to download. Please generate a diagram first.');
            return;
        }
        
        html2canvas(diagramOutput, {
            backgroundColor: '#1e1e1e',
            scale: 2,
            logging: false
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `${currentTab}-diagram.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(error => {
            console.error('Error creating PNG:', error);
            alert('Failed to create PNG. Please try again or use a screenshot tool.');
        });
    }

    // Error handling function
    function handleError(message, error) {
        console.error(message, error);
        diagramOutput.innerHTML = `<div class="error-message">${message}: ${error.message}</div>`;
        
        // Safely disable buttons
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
        
        // Add html2canvas for PNG export
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        document.head.appendChild(script);
        
        // Make sure download buttons are disabled initially
        if (downloadPngBtn) downloadPngBtn.disabled = true;
    }

    // Initialize UI safely
    try {
        initializeUI();
    } catch (error) {
        handleError("Failed to initialize UI", error);
    }
});
