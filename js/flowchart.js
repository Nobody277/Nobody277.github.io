/**
 * Flowchart Editor with:
 * - Node->Node connections (two-segment lines)
 * - Anchored line->node (branching) connections
 * - Automatic canvas expansion
 * - Text items placed anywhere
 */

class FlowchartEditor {
    constructor(canvasElementId) {
        this.canvas = document.getElementById(canvasElementId);
        if (!this.canvas) {
            console.error(`Canvas element with ID ${canvasElementId} not found`);
            return;
        }

        // Node & Connection data
        this.nodes = [];
        this.connections = [];
        this.nextNodeId = 1;
        this.nextConnectionId = 1;

        // Text items
        this.textItems = [];
        this.nextTextId = 1;

        // Selection & modes
        this.selectedNode = null;
        this.selectedConnection = null;
        this.selectedTextItem = null;

        this.connectingMode = false;
        this.connectingSourceNode = null;       // for node->node
        this.connectingSourceLineAnchor = null; // for line->node anchor
        this.addingTextMode = false;            // if user clicked "Add Text"

        // Dragging states
        this.isMouseDown = false;
        this.draggedNode = null;
        this.draggedTextItem = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        // For node creation
        this.isDraggingNewNode = false;
        this.newNodeType = null;

        // SVG namespace
        this.svgNS = "http://www.w3.org/2000/svg";

        // Create SVG container for connections
        this.svgContainer = document.createElementNS(this.svgNS, "svg");
        this.svgContainer.style.position = "absolute";
        this.svgContainer.style.top = "0";
        this.svgContainer.style.left = "0";
        this.svgContainer.style.width = "100%";
        this.svgContainer.style.height = "100%";
        this.svgContainer.style.pointerEvents = "none";
        this.svgContainer.style.zIndex = "1";
        this.canvas.appendChild(this.svgContainer);

        // Define arrowhead marker
        const defs = document.createElementNS(this.svgNS, "defs");
        const arrowMarker = document.createElementNS(this.svgNS, "marker");
        arrowMarker.setAttribute("id", "arrowhead");
        arrowMarker.setAttribute("markerWidth", "10");
        arrowMarker.setAttribute("markerHeight", "7");
        arrowMarker.setAttribute("refX", "0");
        arrowMarker.setAttribute("refY", "3.5");
        arrowMarker.setAttribute("orient", "auto");

        const arrowPolygon = document.createElementNS(this.svgNS, "polygon");
        arrowPolygon.setAttribute("points", "0 0, 10 3.5, 0 7");
        arrowPolygon.setAttribute("fill", "#007396");

        arrowMarker.appendChild(arrowPolygon);
        defs.appendChild(arrowMarker);
        this.svgContainer.appendChild(defs);

        // Ghost node for drag images
        this.ghostNode = document.createElement('div');
        this.ghostNode.className = 'flowchart-node ghost';
        this.ghostNode.style.position = 'absolute';
        this.ghostNode.style.display = 'none';
        this.ghostNode.style.pointerEvents = 'none';
        this.ghostNode.style.opacity = '0.6';
        this.ghostNode.style.zIndex = '100';
        document.body.appendChild(this.ghostNode);

        this.initEventListeners();
    }

    initEventListeners() {
        // Canvas events
        this.canvas.addEventListener('mousedown', this.handleCanvasMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleCanvasMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleCanvasMouseUp.bind(this));
        this.canvas.addEventListener('dragover', this.handleCanvasDragOver.bind(this));
        this.canvas.addEventListener('drop', this.handleCanvasDrop.bind(this));

        // Global events
        document.addEventListener('mousemove', this.handleGlobalMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleGlobalMouseUp.bind(this));

        // Toolbox node buttons
        const nodeButtons = [
            { id: 'add-start-node', type: 'start' },
            { id: 'add-process-node', type: 'process' },
            { id: 'add-decision-node', type: 'decision' },
            { id: 'add-io-node', type: 'io' }
        ];
        nodeButtons.forEach(button => {
            const elem = document.getElementById(button.id);
            elem.setAttribute('draggable', 'true');
            elem.addEventListener('dragstart', (e) => this.handleNodeButtonDragStart(e, button.type));
        });

        // Connect, Delete, Clear, Add Text
        document.getElementById('connect-nodes-btn').addEventListener('click', this.startConnectingMode.bind(this));
        document.getElementById('delete-selection-btn').addEventListener('click', this.deleteSelection.bind(this));
        document.getElementById('clear-flowchart-btn').addEventListener('click', this.clearFlowchart.bind(this));
        document.getElementById('apply-properties-btn').addEventListener('click', this.applyProperties.bind(this));
        document.getElementById('flowchart-download-png-btn').addEventListener('click', this.exportAsPNG.bind(this));

        // NEW: Add Text button
        const addTextBtn = document.getElementById('add-text-btn');
        addTextBtn.addEventListener('click', () => {
            this.addingTextMode = true;
            this.connectingMode = false;  // turn off connecting if on
            this.canvas.classList.remove('connecting-mode');
            // Optionally highlight "Add Text" button
            addTextBtn.classList.add('active');
        });
    }

    handleCanvasMouseDown(e) {
        // 1) If user is in "Add Text" mode and clicked empty space -> place text
        if (this.addingTextMode) {
            if (e.target === this.canvas || e.target === this.svgContainer) {
                // Place text at click
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                this.addTextItemAt(x, y);
                // Turn off addingTextMode after one placement or keep it on?
                this.addingTextMode = false;
                document.getElementById('add-text-btn').classList.remove('active');
                return;
            }
        }

        // If clicked empty space (no node, no line, no text)
        if (e.target === this.canvas || e.target === this.svgContainer) {
            this.deselectAll();
            return;
        }

        this.isMouseDown = true;

        // 2) Check if clicked a text item
        if (e.target.classList.contains('flowchart-text')) {
            // Select the text item
            const textId = e.target.getAttribute('data-text-id');
            const item = this.textItems.find(t => t.id === parseInt(textId));
            if (item) {
                this.deselectAll();
                this.selectTextItem(item);

                // Start dragging
                this.draggedTextItem = item;
                const rect = e.target.getBoundingClientRect();
                const canvasRect = this.canvas.getBoundingClientRect();
                this.dragOffsetX = e.clientX - rect.left;
                this.dragOffsetY = e.clientY - rect.top;
            }
            return;
        }

        // 3) If we clicked a node
        if (
          e.target.classList.contains('flowchart-node') ||
          e.target.parentElement?.classList.contains('flowchart-node')
        ) {
            const nodeElem = e.target.classList.contains('flowchart-node')
                ? e.target
                : e.target.parentElement;
            const nodeId = nodeElem.getAttribute('data-node-id');
            const node = this.nodes.find(n => n.id === parseInt(nodeId));

            if (this.connectingMode) {
                // If we have a source node or line anchor, this node is the target
                if (this.connectingSourceNode) {
                    this.createConnection(this.connectingSourceNode, node);
                    this.exitConnectingMode();
                    return;
                }
                else if (this.connectingSourceLineAnchor) {
                    this.createConnectionFromLineAnchorToNode(this.connectingSourceLineAnchor, node);
                    this.exitConnectingMode();
                    return;
                }
                else {
                    // No source => set this node as source
                    this.connectingSourceNode = node;
                    return;
                }
            }

            // Not connecting => normal selection
            this.deselectAll();
            this.selectNode(node);

            // Start dragging node
            this.draggedNode = node;
            const rect = nodeElem.getBoundingClientRect();
            const canvasRect = this.canvas.getBoundingClientRect();
            this.dragOffsetX = e.clientX - rect.left;
            this.dragOffsetY = e.clientY - rect.top;
        }
        // 4) If we clicked a connection line
        else if (e.target.classList.contains('connection-line')) {
            const connId = e.target.getAttribute('data-connection-id');
            const connection = this.connections.find(c => c.id === parseInt(connId));

            if (this.connectingMode) {
                // If no source, anchor on this line
                if (!this.connectingSourceNode && !this.connectingSourceLineAnchor) {
                    if (connection.sourceId !== undefined && connection.targetId !== undefined) {
                        this.connectingSourceLineAnchor = this.computeLineAnchor(connection, e);
                    } else {
                        console.log("Cannot anchor on a coordinate->node line in this demo.");
                    }
                } else {
                    // Already have a source => line->line is more advanced
                    console.log("Line->line not implemented here.");
                }
            }
            else {
                // Normal selection
                this.deselectAll();
                this.selectConnection(connection);
            }
        }
    }

    handleCanvasMouseMove(e) {
        // Dragging a node
        if (this.isMouseDown && this.draggedNode) {
            this.moveNode(e);
        }
        // Dragging a text item
        else if (this.isMouseDown && this.draggedTextItem) {
            this.moveTextItem(e);
        }
    }

    handleCanvasMouseUp() {
        this.isMouseDown = false;
        this.draggedNode = null;
        this.draggedTextItem = null;
    }

    handleGlobalMouseMove(e) {
        // If user drags outside canvas
        if (this.isMouseDown && this.draggedNode) {
            this.moveNode(e);
        }
        else if (this.isMouseDown && this.draggedTextItem) {
            this.moveTextItem(e);
        }
    }

    handleGlobalMouseUp() {
        this.isMouseDown = false;
        this.draggedNode = null;
        this.draggedTextItem = null;
    }

    moveNode(e) {
        if (!this.draggedNode) return;
        const canvasRect = this.canvas.getBoundingClientRect();
        const x = e.clientX - canvasRect.left - this.dragOffsetX;
        const y = e.clientY - canvasRect.top - this.dragOffsetY;

        const nodeElement = document.getElementById(`node-${this.draggedNode.id}`);
        if (!nodeElement) return;

        const nodeWidth = nodeElement.offsetWidth;
        const nodeHeight = nodeElement.offsetHeight;

        // Let them drag beyond the current canvas size, but we can do bounding if you prefer
        let boundedX = Math.max(0, x);
        let boundedY = Math.max(0, y);

        // Move the node
        this.draggedNode.x = boundedX;
        this.draggedNode.y = boundedY;
        nodeElement.style.left = `${boundedX}px`;
        nodeElement.style.top = `${boundedY}px`;

        // Auto-expand the canvas if near the right/bottom edge
        const nodeRightEdge = boundedX + nodeWidth;
        const nodeBottomEdge = boundedY + nodeHeight;
        const extraSpace = 200;

        // If the node is near or beyond the current scrollWidth/Height, enlarge
        if (nodeRightEdge + 50 > this.canvas.scrollWidth) {
            this.canvas.style.width = (nodeRightEdge + extraSpace) + 'px';
        }
        if (nodeBottomEdge + 50 > this.canvas.scrollHeight) {
            this.canvas.style.height = (nodeBottomEdge + extraSpace) + 'px';
        }

        // Update lines
        this.updateConnections();
    }

    moveTextItem(e) {
        if (!this.draggedTextItem) return;
        const canvasRect = this.canvas.getBoundingClientRect();
        const x = e.clientX - canvasRect.left - this.dragOffsetX;
        const y = e.clientY - canvasRect.top - this.dragOffsetY;

        const textElem = document.getElementById(`text-${this.draggedTextItem.id}`);
        if (!textElem) return;

        // Place text item
        this.draggedTextItem.x = x;
        this.draggedTextItem.y = y;
        textElem.style.left = `${x}px`;
        textElem.style.top = `${y}px`;

        // Auto-expand canvas if near edges
        const textRightEdge = x + textElem.offsetWidth;
        const textBottomEdge = y + textElem.offsetHeight;
        const extraSpace = 200;

        if (textRightEdge + 50 > this.canvas.scrollWidth) {
            this.canvas.style.width = (textRightEdge + extraSpace) + 'px';
        }
        if (textBottomEdge + 50 > this.canvas.scrollHeight) {
            this.canvas.style.height = (textBottomEdge + extraSpace) + 'px';
        }
    }

    handleNodeButtonDragStart(e, nodeType) {
        e.dataTransfer.setData('text/plain', nodeType);

        this.ghostNode.className = `flowchart-node ghost ${nodeType}`;
        this.ghostNode.innerHTML = `<div class="node-content">${this.getDefaultNodeText(nodeType)}</div>`;
        this.ghostNode.style.display = 'flex';

        const offsetX = 60;
        const offsetY = 30;
        e.dataTransfer.setDragImage(this.ghostNode, offsetX, offsetY);

        this.isDraggingNewNode = true;
        this.newNodeType = nodeType;
    }

    handleCanvasDragOver(e) {
        e.preventDefault();
    }

    handleCanvasDrop(e) {
        e.preventDefault();

        const nodeType = e.dataTransfer.getData('text/plain');
        if (!nodeType) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.addNodeAt(nodeType, x, y);

        this.isDraggingNewNode = false;
        this.newNodeType = null;
        this.ghostNode.style.display = 'none';
    }

    /*--------------------------------
     *   TEXT ITEMS
     *--------------------------------*/
    addTextItemAt(x, y) {
        const textItem = {
            id: this.nextTextId++,
            x,
            y,
            text: "New Text"
        };
        this.textItems.push(textItem);
        this.renderTextItem(textItem);

        // Select it so user can rename in properties
        this.deselectAll();
        this.selectTextItem(textItem);
    }

    renderTextItem(item) {
        const textElem = document.createElement('div');
        textElem.id = `text-${item.id}`;
        textElem.className = 'flowchart-text';
        textElem.setAttribute('data-text-id', item.id);

        textElem.style.left = `${item.x}px`;
        textElem.style.top = `${item.y}px`;
        textElem.textContent = item.text;

        this.canvas.appendChild(textElem);
    }

    selectTextItem(item) {
        this.selectedTextItem = item;
        this.selectedNode = null;
        this.selectedConnection = null;

        const textElem = document.getElementById(`text-${item.id}`);
        if (textElem) textElem.classList.add('selected');

        // Show properties
        const propertiesPanel = document.getElementById('node-properties');
        const nodeTextInput = document.getElementById('node-text');
        const connectionTextGroup = document.getElementById('connection-text-group');

        propertiesPanel.style.display = 'block';
        nodeTextInput.value = item.text;
        connectionTextGroup.style.display = 'none';
    }

    /*--------------------------------
     *   NODES
     *--------------------------------*/
    addNodeAt(type, x, y) {
        const node = {
            id: this.nextNodeId++,
            type,
            text: this.getDefaultNodeText(type),
            x,
            y
        };
        this.nodes.push(node);
        this.renderNode(node);

        this.deselectAll();
        this.selectNode(node);
    }

    addNode(type) {
        const node = {
            id: this.nextNodeId++,
            type,
            text: this.getDefaultNodeText(type),
            x: 100 + Math.random() * (this.canvas.offsetWidth - 250),
            y: 100 + Math.random() * (this.canvas.offsetHeight - 250)
        };
        this.nodes.push(node);
        this.renderNode(node);

        this.deselectAll();
        this.selectNode(node);
    }

    getDefaultNodeText(type) {
        switch (type) {
            case 'start':    return 'Start';
            case 'process':  return 'Process';
            case 'decision': return 'Decision?';
            case 'io':       return 'Input/Output';
            case 'end':      return 'End';
            default:         return 'Node';
        }
    }

    renderNode(node) {
        const nodeElement = document.createElement('div');
        nodeElement.id = `node-${node.id}`;
        nodeElement.className = `flowchart-node ${node.type}`;
        nodeElement.setAttribute('data-node-id', node.id);

        nodeElement.style.left = `${node.x}px`;
        nodeElement.style.top = `${node.y}px`;

        const nodeContent = document.createElement('div');
        nodeContent.className = 'node-content';
        nodeContent.textContent = node.text;
        nodeElement.appendChild(nodeContent);

        this.canvas.appendChild(nodeElement);
    }

    selectNode(node) {
        this.selectedNode = node;
        this.selectedConnection = null;
        this.selectedTextItem = null;

        const nodeElem = document.getElementById(`node-${node.id}`);
        if (nodeElem) {
            nodeElem.classList.add('selected');
        }

        const propertiesPanel = document.getElementById('node-properties');
        const nodeTextInput = document.getElementById('node-text');
        const connectionTextGroup = document.getElementById('connection-text-group');

        propertiesPanel.style.display = 'block';
        nodeTextInput.value = node.text;
        connectionTextGroup.style.display = 'none';
    }

    /*--------------------------------
     *   CONNECTIONS
     *--------------------------------*/
    startConnectingMode() {
        this.connectingMode = true;
        this.addingTextMode = false;
        document.getElementById('add-text-btn').classList.remove('active');

        this.connectingSourceNode = null;
        this.connectingSourceLineAnchor = null;

        this.canvas.classList.add('connecting-mode');

        const connectBtn = document.getElementById('connect-nodes-btn');
        connectBtn.classList.add('active');
        connectBtn.textContent = 'Select source';
    }

    exitConnectingMode() {
        this.connectingMode = false;
        this.connectingSourceNode = null;
        this.connectingSourceLineAnchor = null;

        this.canvas.classList.remove('connecting-mode');

        const connectBtn = document.getElementById('connect-nodes-btn');
        connectBtn.classList.remove('active');
        connectBtn.innerHTML = '<i class="fas fa-link"></i><span>Connect Nodes</span>';
    }

    computeLineAnchor(connection, mouseEvent) {
        // Figure out which segment was clicked & ratio
        const rect = this.canvas.getBoundingClientRect();
        const clickX = mouseEvent.clientX - rect.left;
        const clickY = mouseEvent.clientY - rect.top;

        const sourceNode = this.nodes.find(n => n.id === connection.sourceId);
        const targetNode = this.nodes.find(n => n.id === connection.targetId);
        if (!sourceNode || !targetNode) return null;

        const sourceElem = document.getElementById(`node-${sourceNode.id}`);
        const targetElem = document.getElementById(`node-${targetNode.id}`);
        const sx = sourceNode.x + sourceElem.offsetWidth / 2;
        const sy = sourceNode.y + sourceElem.offsetHeight / 2;
        const tx = targetNode.x + targetElem.offsetWidth / 2;
        const ty = targetNode.y + targetElem.offsetHeight / 2;

        const distToHorizontal = Math.abs(clickY - sy);
        const distToVertical   = Math.abs(clickX - tx);

        let anchorSegment, anchorRatio = 0;
        if (distToHorizontal < distToVertical) {
            // Horizontal
            anchorSegment = 'horizontal';
            if (tx !== sx) {
                anchorRatio = (clickX - sx) / (tx - sx);
            }
        } else {
            // Vertical
            anchorSegment = 'vertical';
            if (ty !== sy) {
                anchorRatio = (clickY - sy) / (ty - sy);
            }
        }

        return {
            anchorToConnectionId: connection.id,
            anchorSegment,
            anchorRatio
        };
    }

    createConnection(sourceNode, targetNode) {
        if (sourceNode.id === targetNode.id) return;
        if (this.connections.some(c => c.sourceId === sourceNode.id && c.targetId === targetNode.id)) {
            return;
        }

        const connection = {
            id: this.nextConnectionId++,
            sourceId: sourceNode.id,
            targetId: targetNode.id,
            label: ''
        };
        this.connections.push(connection);
        this.renderConnection(connection);

        this.deselectAll();
        this.selectConnection(connection);
    }

    createConnectionFromLineAnchorToNode(anchorInfo, targetNode) {
        const connection = {
            id: this.nextConnectionId++,
            anchorToConnectionId: anchorInfo.anchorToConnectionId,
            anchorSegment: anchorInfo.anchorSegment,
            anchorRatio: anchorInfo.anchorRatio,
            targetId: targetNode.id,
            label: ''
        };
        this.connections.push(connection);
        this.renderConnection(connection);

        this.deselectAll();
        this.selectConnection(connection);
    }

    selectConnection(connection) {
        this.selectedConnection = connection;
        this.selectedNode = null;
        this.selectedTextItem = null;

        const path = document.getElementById(`connection-${connection.id}`);
        if (path) path.classList.add('selected');

        const propertiesPanel = document.getElementById('node-properties');
        const nodeTextInput = document.getElementById('node-text');
        const connectionTextInput = document.getElementById('connection-text');
        const connectionTextGroup = document.getElementById('connection-text-group');

        propertiesPanel.style.display = 'block';
        nodeTextInput.value = ''; // not editing node text
        connectionTextGroup.style.display = 'block';
        connectionTextInput.value = connection.label || '';
    }

    renderConnection(connection) {
        // If node->node or anchored->node
        if (connection.sourceId !== undefined) {
            // node->node
            const sourceNode = this.nodes.find(n => n.id === connection.sourceId);
            const targetNode = this.nodes.find(n => n.id === connection.targetId);
            if (!sourceNode || !targetNode) return;

            const sourceElem = document.getElementById(`node-${sourceNode.id}`);
            const targetElem = document.getElementById(`node-${targetNode.id}`);
            const sx = sourceNode.x + sourceElem.offsetWidth / 2;
            const sy = sourceNode.y + sourceElem.offsetHeight / 2;
            const tx = targetNode.x + targetElem.offsetWidth / 2;
            const ty = targetNode.y + targetElem.offsetHeight / 2;

            const path = document.createElementNS(this.svgNS, 'path');
            path.id = `connection-${connection.id}`;
            path.setAttribute('class', 'connection-line');
            path.setAttribute('data-connection-id', connection.id);
            path.setAttribute('marker-end', 'url(#arrowhead)');

            const pathData = `M ${sx} ${sy}
                              L ${tx} ${sy}
                              L ${tx} ${ty}`;
            path.setAttribute('d', pathData);
            path.style.pointerEvents = 'stroke';
            this.svgContainer.appendChild(path);

            if (connection.label) {
                const midX = tx;
                const midY = (sy + ty) / 2;
                const labelEl = document.createElement('div');
                labelEl.id = `label-${connection.id}`;
                labelEl.className = 'connection-label';
                labelEl.textContent = connection.label;
                labelEl.style.left = `${midX - 20}px`;
                labelEl.style.top = `${midY - 10}px`;
                this.canvas.appendChild(labelEl);
            }
        }
        else if (connection.anchorToConnectionId !== undefined) {
            // anchored->node
            const baseConn = this.connections.find(c => c.id === connection.anchorToConnectionId);
            if (!baseConn) return;
            if (baseConn.sourceId === undefined || baseConn.targetId === undefined) {
                console.log("Anchoring on coordinate->node line not supported in this demo.");
                return;
            }

            const sourceNode = this.nodes.find(n => n.id === baseConn.sourceId);
            const targetNode = this.nodes.find(n => n.id === baseConn.targetId);
            if (!sourceNode || !targetNode) return;

            const sourceElem = document.getElementById(`node-${sourceNode.id}`);
            const targetElem = document.getElementById(`node-${targetNode.id}`);
            const sx = sourceNode.x + sourceElem.offsetWidth / 2;
            const sy = sourceNode.y + sourceElem.offsetHeight / 2;
            const tx = targetNode.x + targetElem.offsetWidth / 2;
            const ty = targetNode.y + targetElem.offsetHeight / 2;

            let anchorX, anchorY;
            if (connection.anchorSegment === 'horizontal') {
                anchorX = sx + connection.anchorRatio * (tx - sx);
                anchorY = sy;
            } else {
                anchorX = tx;
                anchorY = sy + connection.anchorRatio * (ty - sy);
            }

            const targNode = this.nodes.find(n => n.id === connection.targetId);
            if (!targNode) return;
            const targElem = document.getElementById(`node-${targNode.id}`);
            const tx2 = targNode.x + targElem.offsetWidth / 2;
            const ty2 = targNode.y + targElem.offsetHeight / 2;

            const path = document.createElementNS(this.svgNS, 'path');
            path.id = `connection-${connection.id}`;
            path.setAttribute('class', 'connection-line');
            path.setAttribute('data-connection-id', connection.id);
            path.setAttribute('marker-end', 'url(#arrowhead)');

            const pathData = `M ${anchorX} ${anchorY}
                              L ${tx2} ${anchorY}
                              L ${tx2} ${ty2}`;
            path.setAttribute('d', pathData);
            path.style.pointerEvents = 'stroke';
            this.svgContainer.appendChild(path);

            if (connection.label) {
                const midX = tx2;
                const midY = (anchorY + ty2) / 2;
                const labelEl = document.createElement('div');
                labelEl.id = `label-${connection.id}`;
                labelEl.className = 'connection-label';
                labelEl.textContent = connection.label;
                labelEl.style.left = `${midX - 20}px`;
                labelEl.style.top = `${midY - 10}px`;
                this.canvas.appendChild(labelEl);
            }
        }
    }

    updateConnections() {
        // Clear old
        this.svgContainer.innerHTML = '';

        // Re-add arrowhead
        const defs = document.createElementNS(this.svgNS, 'defs');
        const arrowMarker = document.createElementNS(this.svgNS, 'marker');
        arrowMarker.setAttribute('id', 'arrowhead');
        arrowMarker.setAttribute('markerWidth', '10');
        arrowMarker.setAttribute('markerHeight', '7');
        arrowMarker.setAttribute('refX', '0');
        arrowMarker.setAttribute('refY', '3.5');
        arrowMarker.setAttribute('orient', 'auto');
        const arrowPolygon = document.createElementNS(this.svgNS, 'polygon');
        arrowPolygon.setAttribute('points', '0 0, 10 3.5, 0 7');
        arrowPolygon.setAttribute('fill', '#007396');
        arrowMarker.appendChild(arrowPolygon);
        defs.appendChild(arrowMarker);
        this.svgContainer.appendChild(defs);

        // Remove old labels
        const oldLabels = this.canvas.querySelectorAll('.connection-label');
        oldLabels.forEach(l => l.remove());

        // Re-render each connection
        for (const c of this.connections) {
            this.renderConnection(c);
            if (this.selectedConnection && this.selectedConnection.id === c.id) {
                const path = document.getElementById(`connection-${c.id}`);
                if (path) path.classList.add('selected');
            }
        }
    }

    /*--------------------------------
     *   SELECTION & DELETION
     *--------------------------------*/
    deselectAll() {
        // Nodes
        const selectedNodeElems = document.querySelectorAll('.flowchart-node.selected');
        selectedNodeElems.forEach(elem => elem.classList.remove('selected'));

        // Connections
        const selectedPaths = document.querySelectorAll('.connection-line.selected');
        selectedPaths.forEach(path => path.classList.remove('selected'));

        // Text items
        const selectedTextElems = document.querySelectorAll('.flowchart-text.selected');
        selectedTextElems.forEach(elem => elem.classList.remove('selected'));

        // Hide properties
        document.getElementById('node-properties').style.display = 'none';

        this.selectedNode = null;
        this.selectedConnection = null;
        this.selectedTextItem = null;
    }

    deleteSelection() {
        if (this.selectedNode) {
            // remove node
            const nid = this.selectedNode.id;
            this.nodes = this.nodes.filter(n => n.id !== nid);
            // remove connections referencing it
            this.connections = this.connections.filter(c => {
                if (c.sourceId === nid) return false;
                if (c.targetId === nid) return false;
                if (c.targetId === undefined && c.anchorToConnectionId) {
                    // skip
                }
                return true;
            });
            const nodeElem = document.getElementById(`node-${nid}`);
            if (nodeElem) nodeElem.remove();

            this.updateConnections();
            this.deselectAll();
        }
        else if (this.selectedConnection) {
            // remove connection
            const cid = this.selectedConnection.id;
            this.connections = this.connections.filter(c => c.id !== cid);
            this.updateConnections();
            this.deselectAll();
        }
        else if (this.selectedTextItem) {
            // remove text item
            const tid = this.selectedTextItem.id;
            this.textItems = this.textItems.filter(t => t.id !== tid);
            const textElem = document.getElementById(`text-${tid}`);
            if (textElem) textElem.remove();

            this.deselectAll();
        }
    }

    /*--------------------------------
     *   PROPERTIES PANEL
     *--------------------------------*/
    applyProperties() {
        // If a node is selected
        if (this.selectedNode) {
            const nodeText = document.getElementById('node-text').value;
            this.selectedNode.text = nodeText;
            const nodeElem = document.getElementById(`node-${this.selectedNode.id}`);
            if (nodeElem) {
                const contentElem = nodeElem.querySelector('.node-content');
                if (contentElem) {
                    contentElem.textContent = nodeText;
                }
            }
        }
        // If a connection is selected
        else if (this.selectedConnection) {
            const connectionText = document.getElementById('connection-text').value;
            this.selectedConnection.label = connectionText;
            this.updateConnections();
        }
        // If a text item is selected
        else if (this.selectedTextItem) {
            const nodeText = document.getElementById('node-text').value;
            this.selectedTextItem.text = nodeText;
            const textElem = document.getElementById(`text-${this.selectedTextItem.id}`);
            if (textElem) {
                textElem.textContent = nodeText;
            }
        }
    }

    /*--------------------------------
     *   CLEAR & EXPORT
     *--------------------------------*/
    clearFlowchart() {
        if (confirm('Are you sure you want to clear the entire flowchart?')) {
            this.nodes = [];
            this.connections = [];
            this.textItems = [];

            // Remove DOM elements
            this.canvas.querySelectorAll('.flowchart-node').forEach(n => n.remove());
            this.canvas.querySelectorAll('.connection-label').forEach(l => l.remove());
            this.canvas.querySelectorAll('.flowchart-text').forEach(t => t.remove());
            this.svgContainer.innerHTML = '';

            this.nextNodeId = 1;
            this.nextConnectionId = 1;
            this.nextTextId = 1;

            // Reset size
            this.canvas.style.width = '';
            this.canvas.style.height = '';

            this.deselectAll();
        }
    }

    exportAsPNG() {
        html2canvas(this.canvas).then(canvas => {
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = 'flowchart.png';
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }).catch(error => {
            console.error('Error exporting flowchart:', error);
            alert('Error exporting flowchart: ' + error.message);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const flowchartEditor = new FlowchartEditor('flowchart-canvas');
        window.flowchartEditor = flowchartEditor;
    }, 500);
});
