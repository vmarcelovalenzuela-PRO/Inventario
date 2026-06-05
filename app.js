const tallas = ["35", "36", "37", "38", "39", "40"];
const STORAGE_KEY = "inventario_tienda_pistola";
const HISTORY_KEY = "inventario_tienda_historial";

let inventario = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
let historial = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];

const scanInput = document.getElementById("scan-input");
const cantidadInput = document.getElementById("cantidad-input");
const estadoApp = document.getElementById("estado-app");
const ultimoCodigo = document.getElementById("ultimo-codigo");
const contadorTotal = document.getElementById("contador-total");
const cuerpoTabla = document.getElementById("cuerpo-tabla");
const listaHistorial = document.getElementById("lista-historial");
const btnEnfocar = document.getElementById("btn-enfocar");
const btnExportar = document.getElementById("btn-exportar");
const btnLimpiar = document.getElementById("btn-limpiar");
const modalConfirmacion = document.getElementById("modal-confirmacion");
const modalTitulo = document.getElementById("modal-titulo");
const modalMensaje = document.getElementById("modal-mensaje");
const btnCancelarModal = document.getElementById("btn-cancelar-modal");
const btnConfirmarModal = document.getElementById("btn-confirmar-modal");

let accionConfirmada = null;

function guardar() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventario));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(historial.slice(0, 25)));
}

function enfocarEscaneo() {
    scanInput.focus();
    scanInput.select();
}

function enfocarEscaneoSiConviene() {
    if (document.activeElement === cantidadInput) {
        return;
    }

    enfocarEscaneo();
}

function obtenerCantidad() {
    const cantidad = parseInt(cantidadInput.value, 10);

    if (!Number.isFinite(cantidad) || cantidad < 1) {
        return 1;
    }

    return Math.min(cantidad, 999);
}

function mostrarEstado(texto, tipo = "ok") {
    estadoApp.textContent = texto;
    estadoApp.className = `valor ${tipo}`;
}

function abrirConfirmacion({ titulo, mensaje, textoConfirmar = "Borrar", accion }) {
    modalTitulo.textContent = titulo;
    modalMensaje.textContent = mensaje;
    btnConfirmarModal.textContent = textoConfirmar;
    accionConfirmada = accion;
    modalConfirmacion.classList.remove("modal-oculto");
    btnCancelarModal.focus();
}

function cerrarConfirmacion() {
    modalConfirmacion.classList.add("modal-oculto");
    accionConfirmada = null;
    enfocarEscaneo();
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

function crearHora() {
    return new Date().toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

function nombreFechaHora() {
    const ahora = new Date();
    const yyyy = ahora.getFullYear();
    const mm = String(ahora.getMonth() + 1).padStart(2, "0");
    const dd = String(ahora.getDate()).padStart(2, "0");
    const hh = String(ahora.getHours()).padStart(2, "0");
    const min = String(ahora.getMinutes()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}_${hh}${min}`;
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

function sumarResultado(resultado, cantidad = 1) {
    crearArticulo(resultado.articulo);
    inventario[resultado.articulo][resultado.talla] += cantidad;

    historial.unshift({
        tipo: "suma",
        codigo: resultado.codigo,
        articulo: resultado.articulo,
        talla: resultado.talla,
        cantidad,
        hora: crearHora()
    });

    historial = historial.slice(0, 25);
    guardar();
    renderizar();
    ultimoCodigo.textContent = resultado.codigo;
    mostrarEstado(`Sumado ${cantidad} de ${resultado.articulo}, talla ${resultado.talla}`, "ok");
    emitirBeep();
    cantidadInput.value = "1";
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

    sumarResultado(resultado, obtenerCantidad());
}

function ajustarTalla(articulo, talla, cambio) {
    if (!inventario[articulo]) {
        return;
    }

    const valorActual = inventario[articulo][talla] || 0;

    if (valorActual + cambio < 0) {
        mostrarEstado(`No se puede restar en ${articulo}, talla ${talla}.`, "error");
        enfocarEscaneo();
        return;
    }

    inventario[articulo][talla] += cambio;

    historial.unshift({
        tipo: cambio > 0 ? "suma" : "resta",
        codigo: articulo + talla,
        articulo,
        talla,
        cantidad: Math.abs(cambio),
        hora: crearHora()
    });

    historial = historial.slice(0, 25);

    if (totalArticulo(articulo) === 0) {
        delete inventario[articulo];
    }

    guardar();
    renderizar();
    mostrarEstado(`${cambio > 0 ? "Sumado" : "Restado"} 1 de ${articulo}, talla ${talla}`, "ok");
    enfocarEscaneo();
}

function borrarFila(articulo) {
    if (!inventario[articulo]) {
        return;
    }

    const pares = totalArticulo(articulo);

    abrirConfirmacion({
        titulo: "Borrar fila",
        mensaje: `Vas a borrar el articulo ${articulo} con ${pares} pares contados.`,
        textoConfirmar: "Borrar fila",
        accion: () => {
            delete inventario[articulo];
            historial = historial.filter((item) => item.articulo !== articulo);
            guardar();
            renderizar();
            mostrarEstado(`Fila borrada: ${articulo}`, "ok");
        }
    });
}

function renderizarTabla() {
    const articulos = Object.keys(inventario).sort();

    if (articulos.length === 0) {
        cuerpoTabla.innerHTML = `
            <tr>
                <td colspan="9" class="fila-vacia">Ningun articulo escaneado aun</td>
            </tr>
        `;
        return;
    }

    cuerpoTabla.innerHTML = articulos.map((articulo) => {
        const columnas = tallas.map((talla) => {
            const valor = inventario[articulo][talla];

            return `
                <td class="celda-talla">
                    <span class="control-talla">
                        <button class="btn-restar" type="button" data-articulo="${articulo}" data-talla="${talla}" ${valor === 0 ? "disabled" : ""}>-</button>
                        <span class="cantidad-talla">${valor}</span>
                        <button class="btn-sumar" type="button" data-articulo="${articulo}" data-talla="${talla}">+</button>
                    </span>
                </td>
            `;
        }).join("");

        return `
            <tr>
                <td class="col-articulo">${articulo}</td>
                ${columnas}
                <td class="col-total">${totalArticulo(articulo)}</td>
                <td><button class="btn-borrar-fila" type="button" data-articulo="${articulo}">Borrar</button></td>
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

    listaHistorial.innerHTML = historial.slice(0, 10).map((item) => {
        const signo = item.tipo === "resta" ? "-" : "+";

        return `
        <div class="historial-item">
            <strong>${item.articulo} - talla ${item.talla}</strong>
            <span>${item.codigo} · ${signo}${item.cantidad || 1} · ${item.hora}</span>
        </div>
    `;
    }).join("");
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
    const fecha = nombreFechaHora();

    enlace.href = URL.createObjectURL(blob);
    enlace.download = `inventario_${fecha}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);

    mostrarEstado("Archivo descargado.", "ok");
    enfocarEscaneo();
}

function limpiarTodo() {
    abrirConfirmacion({
        titulo: "Limpiar inventario",
        mensaje: `Vas a borrar todo el inventario guardado: ${totalGeneral()} pares contados.`,
        textoConfirmar: "Limpiar todo",
        accion: () => {
            inventario = {};
            historial = [];
            guardar();
            renderizar();
            ultimoCodigo.textContent = "Ninguno";
            mostrarEstado("Inventario limpiado.", "ok");
        }
    });
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

cantidadInput.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter") {
        evento.preventDefault();
        enfocarEscaneo();
    }
});

cantidadInput.addEventListener("focus", () => {
    cantidadInput.select();
});

cantidadInput.addEventListener("change", () => {
    cantidadInput.value = String(obtenerCantidad());
});

document.addEventListener("click", (evento) => {
    if (evento.target.tagName !== "BUTTON" && evento.target !== cantidadInput) {
        enfocarEscaneo();
    }
});

btnEnfocar.addEventListener("click", enfocarEscaneo);
btnExportar.addEventListener("click", descargarExcel);
btnLimpiar.addEventListener("click", limpiarTodo);
btnCancelarModal.addEventListener("click", cerrarConfirmacion);
btnConfirmarModal.addEventListener("click", () => {
    if (accionConfirmada) {
        accionConfirmada();
    }

    cerrarConfirmacion();
});

modalConfirmacion.addEventListener("click", (evento) => {
    if (evento.target === modalConfirmacion) {
        cerrarConfirmacion();
    }
});

document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && !modalConfirmacion.classList.contains("modal-oculto")) {
        cerrarConfirmacion();
    }
});

cuerpoTabla.addEventListener("click", (evento) => {
    const boton = evento.target.closest(".btn-borrar-fila");

    if (!boton) {
        return;
    }

    borrarFila(boton.dataset.articulo);
});

cuerpoTabla.addEventListener("click", (evento) => {
    const boton = evento.target.closest(".btn-restar");

    if (!boton) {
        return;
    }

    ajustarTalla(boton.dataset.articulo, boton.dataset.talla, -1);
});

cuerpoTabla.addEventListener("click", (evento) => {
    const boton = evento.target.closest(".btn-sumar");

    if (!boton) {
        return;
    }

    ajustarTalla(boton.dataset.articulo, boton.dataset.talla, 1);
});

renderizar();
enfocarEscaneo();
