document.addEventListener('DOMContentLoaded', function() {
    // Initialize Mermaid
    mermaid.initialize({
        startOnLoad: true,
        theme: 'default',
        securityLevel: 'loose',
        flowchart: {
            useMaxWidth: true,
            htmlLabels: true
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
    const downloadBtn = document.getElementById('download-btn');

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
    downloadBtn.addEventListener('click', downloadSVG);

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
            mermaid.init(undefined, document.querySelectorAll('.mermaid'));
            downloadBtn.disabled = false;
        } catch (error) {
            diagramOutput.innerHTML = `<div class="error">Error generating diagram: ${error.message}</div>`;
            downloadBtn.disabled = true;
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
        // Find method bodies to analyze
        const methodBodyRegex = /(\w+)\s+(\w+)\s*\(([^)]*)\)\s*{([^{}]*(?:{[^{}]*}[^{}]*)*?)}/g;
        let methodMatch;
        let mermaidCode = 'flowchart TD\n';
        
        while ((methodMatch = methodBodyRegex.exec(javaCode)) !== null) {
            const returnType = methodMatch[1];
            const methodName = methodMatch[2];
            const params = methodMatch[3];
            const body = methodMatch[4];
            
            // Add method start
            mermaidCode += `    start_${methodName}[Start ${methodName}] --> process_${methodName}_1\n`;
            
            // Process the method body for basic flow elements
            let statementCount = 1;
            
            // Handle if statements
            const ifRegex = /if\s*\(([^)]+)\)/g;
            let ifMatch;
            while ((ifMatch = ifRegex.exec(body)) !== null) {
                const condition = ifMatch[1].replace(/&&/g, 'AND').replace(/\|\|/g, 'OR');
                mermaidCode += `    process_${methodName}_${statementCount}[${methodName} Process] --> condition_${methodName}_${statementCount}{${condition}?}\n`;
                mermaidCode += `    condition_${methodName}_${statementCount} -->|Yes| process_${methodName}_${statementCount + 1}[If Block]\n`;
                mermaidCode += `    condition_${methodName}_${statementCount} -->|No| process_${methodName}_${statementCount + 2}[Continue]\n`;
                statementCount += 3;
            }
            
            // Handle loops (for, while)
            const loopRegex = /(for|while)\s*\(([^)]+)\)/g;
            let loopMatch;
            while ((loopMatch = loopRegex.exec(body)) !== null) {
                const loopType = loopMatch[1];
                const loopCondition = loopMatch[2].replace(/&&/g, 'AND').replace(/\|\|/g, 'OR');
                mermaidCode += `    process_${methodName}_${statementCount}[${methodName} Process] --> loop_${methodName}_${statementCount}{${loopType}: ${loopCondition}}\n`;
                mermaidCode += `    loop_${methodName}_${statementCount} -->|Body| process_${methodName}_${statementCount + 1}[Loop Body]\n`;
                mermaidCode += `    process_${methodName}_${statementCount + 1} --> loop_${methodName}_${statementCount}\n`;
                mermaidCode += `    loop_${methodName}_${statementCount} -->|Exit| process_${methodName}_${statementCount + 2}[Continue]\n`;
                statementCount += 3;
            }
            
            // Handle method return
            const returnRegex = /return\s+([^;]+);/g;
            let returnMatch;
            while ((returnMatch = returnRegex.exec(body)) !== null) {
                const returnValue = returnMatch[1];
                mermaidCode += `    process_${methodName}_${statementCount}[${methodName} Process] --> return_${methodName}[Return ${returnValue}]\n`;
                statementCount += 1;
            }
            
            // Add method end
            mermaidCode += `    process_${methodName}_${statementCount} --> end_${methodName}[End ${methodName}]\n`;
        }
        
        return mermaidCode;
    }

    function downloadSVG() {
        const svgElement = diagramOutput.querySelector('svg');
        if (svgElement) {
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
        }
    }

    // Advanced Java parsing for better diagram generation
    function improveJavaCodeParsing() {
        // This function can be expanded to improve the parsing logic
        // for more accurate class diagrams and flowcharts
        console.log("Advanced parsing will be implemented in future updates");
    }

    // Initialize UI elements
    function initializeUI() {
        // Add initial example code to help users get started
        javaCodeTextarea.value = `public class Person {
    private String name;
    private int age;
    
    public Person(String name, int age) {
        this.name = name;
        this.age = age;
    }
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public int getAge() {
        return age;
    }
    
    public void setAge(int age) {
        if (age > 0) {
            this.age = age;
        }
    }
}`;
    }

    // Initialize UI
    initializeUI();
});
