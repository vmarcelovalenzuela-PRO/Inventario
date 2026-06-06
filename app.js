/*
 * Control de Bodega C/MORAN
 * Desarrollado por Marcelo Valenzuela.
 * Uso interno para inventario de tienda.
 * Prohibida su copia, venta o distribucion sin autorizacion.
 */

const tallas = ["35", "36", "37", "38", "39", "40", "41"];
const HISTORIAL_MAXIMO = 15;
const HISTORIAL_VISIBLE = 3;
const curvas = {
    G04: {
        "35": 1,
        "36": 2,
        "37": 3,
        "38": 3,
        "39": 2,
        "40": 1,
        "41": 0
    },
    G08: {
        "35": 0,
        "36": 1,
        "37": 2,
        "38": 1,
        "39": 1,
        "40": 0,
        "41": 1
    },
    G02: {
        "35": 1,
        "36": 3,
        "37": 4,
        "38": 3,
        "39": 1,
        "40": 0,
        "41": 0
    }
};
const STORAGE_KEY = "inventario_tienda_pistola";
const HISTORY_KEY = "inventario_tienda_historial";

let inventario = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
let historial = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
let inicioEntradaCodigo = 0;

const scanInput = document.getElementById("scan-input");
const scanForm = document.getElementById("scan-form");
const cantidadInput = document.getElementById("cantidad-input");
const estadoApp = document.getElementById("estado-app");
const ultimoCodigo = document.getElementById("ultimo-codigo");
const contadorTotal = document.getElementById("contador-total");
const cuerpoTabla = document.getElementById("cuerpo-tabla");
const listaHistorial = document.getElementById("lista-historial");
const btnEnfocar = document.getElementById("btn-enfocar");
const btnExportar = document.getElementById("btn-exportar");
const btnCompartir = document.getElementById("btn-compartir");
const btnLimpiar = document.getElementById("btn-limpiar");
const modalConfirmacion = document.getElementById("modal-confirmacion");
const modalTitulo = document.getElementById("modal-titulo");
const modalMensaje = document.getElementById("modal-mensaje");
const btnCancelarModal = document.getElementById("btn-cancelar-modal");
const btnConfirmarModal = document.getElementById("btn-confirmar-modal");

let accionConfirmada = null;

function guardar() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventario));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(historial.slice(0, HISTORIAL_MAXIMO)));
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

function limpiarEntrada(codigo) {
    return String(codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function interpretarCodigo(codigoOriginal) {
    const entrada = limpiarEntrada(codigoOriginal);

    if (entrada.length !== 13) {
        return {
            error: `Codigo invalido: debe tener 13 caracteres y tiene ${entrada.length}.`,
            codigo: entrada
        };
    }

    const codigoCurva = Object.keys(curvas).find((curva) => entrada.endsWith(curva));

    if (codigoCurva) {
        const articulo = entrada.slice(0, -codigoCurva.length);

        if (articulo.length === 0) {
            return {
                error: `Codigo ${codigoCurva} invalido: falta articulo.`,
                codigo: entrada
            };
        }

        return {
            codigo: entrada,
            articulo,
            talla: codigoCurva,
            curva: curvas[codigoCurva]
        };
    }

    const codigo = limpiarCodigo(entrada);

    const finalTres = codigo.slice(-3);
    const esTallaEspecial35 = finalTres === "099" || finalTres === "009";
    const talla = esTallaEspecial35 ? "35" : codigo.slice(-2);
    const articulo = esTallaEspecial35 ? codigo.slice(0, -3) : codigo.slice(0, -2);

    if (!tallas.includes(talla)) {
        return {
            error: `Talla invalida: ${talla}. Solo se acepta 35 a 41.`,
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
            "40": 0,
            "41": 0
        };
    }

    for (const talla of tallas) {
        if (typeof inventario[articulo][talla] !== "number") {
            inventario[articulo][talla] = 0;
        }
    }
}

function totalArticulo(articulo) {
    return tallas.reduce((total, talla) => total + inventario[articulo][talla], 0);
}

function totalGeneral() {
    return Object.keys(inventario).reduce((total, articulo) => total + totalArticulo(articulo), 0);
}

function totalCurva(curva) {
    return tallas.reduce((total, talla) => total + (curva[talla] || 0), 0);
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

function crearArchivoInventario() {
    const articulos = Object.keys(inventario).sort();

    if (articulos.length === 0) {
        return null;
    }

    let csv = "sep=;\r\n";
    csv += "Articulo;35;36;37;38;39;40;41;Total\r\n";

    for (const articulo of articulos) {
        crearArticulo(articulo);
        const fila = inventario[articulo];
        csv += `${articulo};${fila["35"]};${fila["36"]};${fila["37"]};${fila["38"]};${fila["39"]};${fila["40"]};${fila["41"]};${totalArticulo(articulo)}\r\n`;
    }

    const nombre = `inventario_${nombreFechaHora()}.csv`;
    const blob = new Blob(
        [new Uint8Array([0xEF, 0xBB, 0xBF]), csv],
        { type: "text/csv;charset=utf-8;" }
    );

    return { nombre, blob };
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

    if (resultado.curva) {
        for (const talla of tallas) {
            inventario[resultado.articulo][talla] += (resultado.curva[talla] || 0) * cantidad;
        }
    } else {
        inventario[resultado.articulo][resultado.talla] += cantidad;
    }

    historial.unshift({
        tipo: "suma",
        codigo: resultado.codigo,
        articulo: resultado.articulo,
        talla: resultado.talla,
        cantidad: resultado.curva ? totalCurva(resultado.curva) * cantidad : cantidad,
        detalle: resultado.curva ? `${resultado.talla} x${cantidad}` : "",
        hora: crearHora()
    });

    historial = historial.slice(0, HISTORIAL_MAXIMO);
    guardar();
    renderizar();
    ultimoCodigo.textContent = resultado.codigo;
    if (resultado.curva) {
        mostrarEstado(`Sumada caja ${resultado.talla}: ${totalCurva(resultado.curva) * cantidad} pares en ${resultado.articulo}`, "ok");
    } else {
        mostrarEstado(`Sumado ${cantidad} de ${resultado.articulo}, talla ${resultado.talla}`, "ok");
    }
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

function procesarCodigoActual() {
    const codigo = scanInput.value;
    scanInput.value = "";
    inicioEntradaCodigo = 0;
    procesarLectura(codigo);
}

function hayCodigoPendiente() {
    const entrada = limpiarEntrada(scanInput.value);

    if (Object.keys(curvas).some((curva) => entrada.endsWith(curva))) {
        return entrada.length === 13;
    }

    const largo = limpiarCodigo(entrada).length;
    return largo === 13;
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

    historial = historial.slice(0, HISTORIAL_MAXIMO);

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
                <td colspan="10" class="fila-vacia">Ningun articulo escaneado aun</td>
            </tr>
        `;
        return;
    }

    cuerpoTabla.innerHTML = articulos.map((articulo) => {
        crearArticulo(articulo);
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

    listaHistorial.innerHTML = historial.slice(0, HISTORIAL_VISIBLE).map((item) => {
        const signo = item.tipo === "resta" ? "-" : "+";

        const titulo = item.talla && item.talla.startsWith("G")
            ? `${item.articulo} - caja ${item.talla}`
            : `${item.articulo} - talla ${item.talla}`;

        return `
        <div class="historial-item">
            <strong>${titulo}</strong>
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
    const archivo = crearArchivoInventario();

    if (!archivo) {
        mostrarEstado("No hay datos para exportar.", "error");
        enfocarEscaneo();
        return;
    }

    const enlace = document.createElement("a");

    enlace.href = URL.createObjectURL(archivo.blob);
    enlace.download = archivo.nombre;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);

    mostrarEstado("Archivo descargado.", "ok");
    enfocarEscaneo();
}

async function compartirExcel() {
    const archivo = crearArchivoInventario();

    if (!archivo) {
        mostrarEstado("No hay datos para compartir.", "error");
        enfocarEscaneo();
        return;
    }

    const file = new File([archivo.blob], archivo.nombre, {
        type: "text/csv"
    });

    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        try {
            await navigator.share({
                title: "Inventario",
                text: "Inventario de bodega",
                files: [file]
            });
            mostrarEstado("Archivo compartido.", "ok");
        } catch (error) {
            mostrarEstado("Compartir cancelado.", "error");
        }

        enfocarEscaneo();
        return;
    }

    mostrarEstado("Este navegador no permite compartir archivos. Se descargó una copia.", "error");
    descargarExcel();
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

    const tiempoEscritura = Date.now() - inicioEntradaCodigo;
    const parecePistola = tiempoEscritura > 0 && tiempoEscritura < 900;

    if (limpiarCodigo(scanInput.value).length === 13 && cantidadInput.value === "1" && parecePistola) {
        procesarCodigoActual();
        return;
    }

    cantidadInput.focus();
    cantidadInput.select();
});

scanInput.addEventListener("input", () => {
    if (!inicioEntradaCodigo && limpiarCodigo(scanInput.value).length > 0) {
        inicioEntradaCodigo = Date.now();
    }

    if (limpiarCodigo(scanInput.value).length === 0) {
        inicioEntradaCodigo = 0;
    }
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

        if (hayCodigoPendiente()) {
            procesarCodigoActual();
            return;
        }

        enfocarEscaneo();
    }
});

cantidadInput.addEventListener("focus", () => {
    cantidadInput.select();
});

cantidadInput.addEventListener("change", () => {
    cantidadInput.value = String(obtenerCantidad());
});

cantidadInput.addEventListener("blur", () => {
    if (hayCodigoPendiente()) {
        setTimeout(() => {
            if (hayCodigoPendiente()) {
                procesarCodigoActual();
            }
        }, 80);
    }
});

scanForm.addEventListener("submit", (evento) => {
    evento.preventDefault();

    if (hayCodigoPendiente()) {
        procesarCodigoActual();
        return;
    }

    mostrarEstado("Falta ingresar un codigo valido.", "error");
    enfocarEscaneo();
});

document.addEventListener("click", (evento) => {
    if (evento.target.tagName !== "BUTTON" && evento.target !== cantidadInput) {
        enfocarEscaneo();
    }
});

btnEnfocar.addEventListener("click", enfocarEscaneo);
btnExportar.addEventListener("click", descargarExcel);
btnCompartir.addEventListener("click", compartirExcel);
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
