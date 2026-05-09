const fs = require('fs');

function generateHtml(mdFile, htmlFile, title) {
    if (!fs.existsSync(mdFile)) return;
    const content = fs.readFileSync(mdFile, 'utf8');
    
    let mermaidCode = content;
    mermaidCode = mermaidCode.replace(/```mermaid\s*/, '');
    mermaidCode = mermaidCode.replace(/```\s*$/, '');
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js"></script>
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        mermaid.initialize({ 
            startOnLoad: false,
            maxTextSize: 9000000,
            theme: 'default'
        });

        async function initGraph() {
            const container = document.getElementById('graph-container');
            const code = \`${mermaidCode.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
            
            try {
                const { svg } = await mermaid.render('mermaid-svg', code);
                container.innerHTML = svg;
                
                const svgElement = container.querySelector('svg');
                svgElement.setAttribute('width', '100%');
                svgElement.setAttribute('height', '100%');
                
                window.panZoom = svgPanZoom(svgElement, {
                    zoomEnabled: true,
                    controlIconsEnabled: true,
                    fit: true,
                    center: true,
                    minZoom: 0.1,
                    maxZoom: 10
                });
            } catch (e) {
                container.innerHTML = '<pre style="color:red">' + e.message + '</pre>';
            }
        }
        
        window.addEventListener('load', initGraph);
    </script>
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; font-family: sans-serif; }
        .header { padding: 10px 20px; background: #fff; border-bottom: 1px solid #ddd; height: 50px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; }
        #graph-container { width: 100%; height: calc(100% - 50px); background: #f8f9fa; cursor: grab; }
        #graph-container:active { cursor: grabbing; }
        .controls-hint { font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <strong>${title}</strong>
        <span class="controls-hint">Rueda: Zoom | Arrastrar: Mover | Usa los iconos de abajo para resetear</span>
    </div>
    <div id="graph-container">
        <p style="padding: 20px;">Cargando mapa interactivo...</p>
    </div>
</body>
</html>`;
    
    fs.writeFileSync(htmlFile, html);
    console.log(`Generado con zoom: ${htmlFile}`);
}

generateHtml('backend-graph.md', 'backend-graph.html', 'Arquitectura del Backend');
generateHtml('mobile-graph.md', 'mobile-graph.html', 'Arquitectura Mobile');
