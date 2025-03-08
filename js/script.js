document.addEventListener('DOMContentLoaded', function() {
    // Initialize Mermaid
    mermaid.initialize({
        startOnLoad: true,
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
        }
    });

    // DOM Elements
    const tabButtons = document.querySelectorAll('.tab-btn');
    const inputRadios = document.querySelectorAll('input[name="input-method"]');
    const pasteContainer = document.getElementById('paste-container');
    const uploadContainer = document.getElementById('upload-container');
    const javaCodeTextarea = document.getElementById('java-code');
    const fileUpload = document.getElementById('file-upload');
    const generateBtn = document.getElementById('generate-btn');
    const diagramOutput = document.getElementById('diagram-output');
    const downloadSvgBtn = document.getElementById('download-svg-btn');
    const downloadPngBtn = document.getElementById('download-png-btn');

    // Current state
    let currentTab = 'class-diagram';

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

    fileUpload.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                javaCodeTextarea.value = e.target.result;
            };
            reader.readAsText(file);
        }
    });

    generateBtn.addEventListener('click', generateDiagram);
    
    if (downloadSvgBtn) {
        downloadSvgBtn.addEventListener('click', () => downloadDiagram('svg'));
    }
    
    if (downloadPngBtn) {
        downloadPngBtn.addEventListener('click', () => downloadDiagram('png'));
    }

    // Functions
    function generateDiagram() {
        const javaCode = javaCodeTextarea.value.trim();
        
        if (!javaCode) {
            alert('Please enter Java code or upload a file.');
            return;
        }

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
                
                // Only enable download buttons if diagram was successfully generated
                if (diagramOutput.querySelector('svg')) {
                    if (downloadSvgBtn) downloadSvgBtn.disabled = false;
                    if (downloadPngBtn) downloadPngBtn.disabled = false;
                } else {
                    throw new Error("SVG diagram was not created");
                }
            } catch (mermaidError) {
                handleError("Mermaid diagram generation failed", mermaidError);
            }
        } catch (error) {
            handleError("Error generating diagram", error);
        }
    }

    function generateClassDiagram(javaCode) {
        const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/g;
        const fieldRegex = /(private|public|protected)\s+(?:final\s+)?(\w+(?:<[\w<>,\s]+>)?)\s+(\w+)(?:\s*=\s*[^;]+)?;/g;
        const methodRegex = /(private|public|protected)\s+(?:static\s+)?(\w+(?:<[\w<>,\s]+>)?)\s+(\w+)\s*\(([^)]*)\)/g;

        let classMatch;
        let classes = [];
        let relationships = [];

        while ((classMatch = classRegex.exec(javaCode)) !== null) {
            const className = classMatch[1];
            const parentClass = classMatch[2];
            const interfaces = classMatch[3];
            
            // Track class for diagram
            classes.push(className);
            
            // Track inheritance relationship
            if (parentClass) {
                relationships.push(`${className} --|> ${parentClass} : extends`);
            }
            
            // Track interface implementations
            if (interfaces) {
                const interfaceList = interfaces.split(',').map(i => i.trim());
                interfaceList.forEach(intf => {
                    relationships.push(`${className} ..|> ${intf} : implements`);
                });
            }
        }

        // Build the class diagram in Mermaid syntax
        let mermaidCode = 'classDiagram\n';

        // Add classes with fields and methods
        for (const className of classes) {
            mermaidCode += `    class ${className} {\n`;
            
            // Reset regex lastIndex
            fieldRegex.lastIndex = 0;
            methodRegex.lastIndex = 0;
            
            let fieldMatch;
            while ((fieldMatch = fieldRegex.exec(javaCode)) !== null) {
                const visibility = fieldMatch[1] === 'private' ? '-' : (fieldMatch[1] === 'protected' ? '#' : '+');
                const type = fieldMatch[2];
                const name = fieldMatch[3];
                mermaidCode += `        ${visibility} ${name} : ${type}\n`;
            }
            
            let methodMatch;
            while ((methodMatch = methodRegex.exec(javaCode)) !== null) {
                const visibility = methodMatch[1] === 'private' ? '-' : (methodMatch[1] === 'protected' ? '#' : '+');
                const returnType = methodMatch[2];
                const name = methodMatch[3];
                const params = methodMatch[4];
                mermaidCode += `        ${visibility} ${name}(${params}) : ${returnType}\n`;
            }
            
            mermaidCode += '    }\n';
        }

        // Add relationships
        relationships.forEach(rel => {
            mermaidCode += `    ${rel}\n`;
        });

        return mermaidCode;
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
                // Add main method signature
                flowchart += `    class --> mainSig[public static void main(String]\n`;
                flowchart += `    mainSig:::codeStyle\n`;
                flowchart += `    mainSig --> args[args)]\n`;
                flowchart += `    args:::codeStyle\n`;
                
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
                        flowchart += `    args --> outerInit[${outerInit}]\n`;
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
        flowchart += `\n    classDef classStyle fill:#d32f2f,stroke:#d32f2f,color:white,rx:25,ry:25\n`;
        flowchart += `    classDef conditionStyle fill:#d32f2f,stroke:#d32f2f,color:white,shape:diamond\n`;
        flowchart += `    classDef codeStyle fill:#3949ab,stroke:#3949ab,color:white\n`;
        
        return flowchart;
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
        for (int i = 1; i <= 3; i++) {
            for (int j = 1; j <= 3; j++) {
                System.out.println("i: " + i + ", j: " + j);
            }
        }
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
