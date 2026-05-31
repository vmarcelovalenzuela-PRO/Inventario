const tallas = ["35", "36", "37", "38", "39", "40"];
const STORAGE_KEY = "inventario_tienda_pistola";

let inventario = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
let historial = [];
let ultimoValido = null;

const scanInput = document.getElementById("scan-input");
const estadoApp = document.getElementById("estado-app");
const ultimoCodigo = document.getElementById("ultimo-codigo");
const contadorTotal = document.getElementById("contador-total");
const cuerpoTabla = document.getElementById("cuerpo-tabla");
const listaHistorial = document.getElementById("lista-historial");
const btnEnfocar = document.getElementById("btn-enfocar");
const btnSumarUltimo = document.getElementById("btn-sumar-ultimo");
const btnDeshacer = document.getElementById("btn-deshacer");
const btnExportar = document.getElementById("btn-exportar");
const btnLimpiar = document.getElementById("btn-limpiar");

function guardar() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventario));
}

function enfocarEscaneo() {
    scanInput.focus();
    scanInput.select();
}

function mostrarEstado(texto, tipo = "ok") {
    estadoApp.textContent = texto;
    estadoApp.className = `valor ${tipo}`;
}

function limpiarCodigo(codigo) {
    return String(codigo || "").replace(/\D/g, "");
}

function interpretarCodigo(codigoOriginal) {
    const codigo = limpiarCodigo(codigoOriginal);

    if (codigo.length !== 13) {
        return {
            error: `Codigo invalido: debe tener 13 numeros y tiene ${codigo.length}.`,
            codigo
        };
    }

    const articulo = codigo.slice(0, -2);
    const talla = codigo.slice(-2);

    if (!tallas.includes(talla)) {
        return {
            error: `Talla invalida: ${talla}. Solo se acepta 35 a 40.`,
            codigo
        };
    }

    return { codigo, articulo, talla };
}

function crearArticulo(articulo) {
    if (!inventario[articulo]) {
        inventario[articulo] = {
            "35": 0,
            "36": 0,
            "37": 0,
            "38": 0,
            "39": 0,
            "40": 0
        };
    }
}

function totalArticulo(articulo) {
    return tallas.reduce((total, talla) => total + inventario[articulo][talla], 0);
}

function totalGeneral() {
    return Object.keys(inventario).reduce((total, articulo) => total + totalArticulo(articulo), 0);
}

function emitirBeep() {
    const AudioContexto = window.AudioContext || window.webkitAudioContext;

    if (!AudioContexto) {
        return;
    }

    const audio = new AudioContexto();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, audio.currentTime);
    gain.gain.setValueAtTime(0.07, audio.currentTime);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.08);
}

function sumarResultado(resultado, repetido = false) {
    crearArticulo(resultado.articulo);
    inventario[resultado.articulo][resultado.talla] += 1;

    historial.unshift({
        codigo: resultado.codigo,
        articulo: resultado.articulo,
        talla: resultado.talla,
        hora: new Date().toLocaleTimeString("es-CL", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        })
    });

    historial = historial.slice(0, 25);
    ultimoValido = {
        codigo: resultado.codigo,
        articulo: resultado.articulo,
        talla: resultado.talla
    };
    guardar();
    renderizar();
    ultimoCodigo.textContent = resultado.codigo;
    mostrarEstado(`${repetido ? "Sumado de nuevo" : "Sumado"} ${resultado.articulo}, talla ${resultado.talla}`, "ok");
    emitirBeep();
    enfocarEscaneo();
}

function procesarLectura(codigoOriginal) {
    const resultado = interpretarCodigo(codigoOriginal);

    if (resultado.error) {
        ultimoCodigo.textContent = resultado.codigo || String(codigoOriginal || "vacio");
        mostrarEstado(resultado.error, "error");
        enfocarEscaneo();
        return;
    }

    sumarResultado(resultado);
}

function sumarUltimo() {
    if (!ultimoValido) {
        mostrarEstado("Primero escanea o escribe un codigo valido.", "error");
        enfocarEscaneo();
        return;
    }

    sumarResultado(ultimoValido, true);
}

function deshacerUltimo() {
    const ultimo = historial.shift();

    if (!ultimo) {
        mostrarEstado("No hay lecturas para deshacer.", "error");
        enfocarEscaneo();
        return;
    }

    if (inventario[ultimo.articulo] && inventario[ultimo.articulo][ultimo.talla] > 0) {
        inventario[ultimo.articulo][ultimo.talla] -= 1;

        if (totalArticulo(ultimo.articulo) === 0) {
            delete inventario[ultimo.articulo];
        }
    }

    guardar();
    renderizar();
    mostrarEstado(`Deshecho ${ultimo.articulo}, talla ${ultimo.talla}`, "ok");
    enfocarEscaneo();
}

function renderizarTabla() {
    const articulos = Object.keys(inventario).sort();

    if (articulos.length === 0) {
        cuerpoTabla.innerHTML = `
            <tr>
                <td colspan="8" class="fila-vacia">Ningun articulo escaneado aun</td>
            </tr>
        `;
        return;
    }

    cuerpoTabla.innerHTML = articulos.map((articulo) => {
        const columnas = tallas.map((talla) => `<td>${inventario[articulo][talla]}</td>`).join("");

        return `
            <tr>
                <td class="col-articulo">${articulo}</td>
                ${columnas}
                <td class="col-total">${totalArticulo(articulo)}</td>
            </tr>
        `;
    }).join("");
}

function renderizarHistorial() {
    if (historial.length === 0) {
        listaHistorial.innerHTML = `
            <div class="historial-item">
                <span>Sin lecturas todavia</span>
            </div>
        `;
        return;
    }

    listaHistorial.innerHTML = historial.slice(0, 10).map((item) => `
        <div class="historial-item">
            <strong>${item.articulo} - talla ${item.talla}</strong>
            <span>${item.codigo} · ${item.hora}</span>
        </div>
    `).join("");
}

function renderizar() {
    renderizarTabla();
    renderizarHistorial();
    contadorTotal.textContent = totalGeneral();
}

function descargarExcel() {
    const articulos = Object.keys(inventario).sort();

    if (articulos.length === 0) {
        mostrarEstado("No hay datos para exportar.", "error");
        enfocarEscaneo();
        return;
    }

    let csv = "sep=;\r\n";
    csv += "Articulo;35;36;37;38;39;40;Total\r\n";

    for (const articulo of articulos) {
        const fila = inventario[articulo];
        csv += `${articulo};${fila["35"]};${fila["36"]};${fila["37"]};${fila["38"]};${fila["39"]};${fila["40"]};${totalArticulo(articulo)}\r\n`;
    }

    const blob = new Blob(
        [new Uint8Array([0xEF, 0xBB, 0xBF]), csv],
        { type: "text/csv;charset=utf-8;" }
    );
    const enlace = document.createElement("a");
    const fecha = new Date().toISOString().slice(0, 10);

    enlace.href = URL.createObjectURL(blob);
    enlace.download = `inventario_${fecha}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);

    mostrarEstado("Archivo descargado.", "ok");
    enfocarEscaneo();
}

function limpiarTodo() {
    if (!confirm("Quieres borrar todo el inventario guardado?")) {
        enfocarEscaneo();
        return;
    }

    inventario = {};
    historial = [];
    ultimoValido = null;
    guardar();
    renderizar();
    ultimoCodigo.textContent = "Ninguno";
    mostrarEstado("Inventario limpiado.", "ok");
    enfocarEscaneo();
}

scanInput.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter") {
        return;
    }

    evento.preventDefault();
    const codigo = scanInput.value;
    scanInput.value = "";
    procesarLectura(codigo);
});

scanInput.addEventListener("paste", () => {
    setTimeout(() => {
        const codigo = scanInput.value;

        if (limpiarCodigo(codigo).length === 13) {
            scanInput.value = "";
            procesarLectura(codigo);
        }
    }, 0);
});

document.addEventListener("click", (evento) => {
    if (evento.target.tagName !== "BUTTON") {
        enfocarEscaneo();
    }
});

btnEnfocar.addEventListener("click", enfocarEscaneo);
btnSumarUltimo.addEventListener("click", sumarUltimo);
btnDeshacer.addEventListener("click", deshacerUltimo);
btnExportar.addEventListener("click", descargarExcel);
btnLimpiar.addEventListener("click", limpiarTodo);

renderizar();
enfocarEscaneo();
