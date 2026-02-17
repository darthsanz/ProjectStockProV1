import { supabase } from "../services/supabase";
// 1. Captura de elementos
const inventoryList = document.getElementById("inventoryList");
// 2. Validación de desarrollador (Sin return)
if (!inventoryList) {
  console.error("Error: No se encontró el contenedor de la lista en el HTML.");
}
// 3. Portero de seguridad
async function protectPage() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.replace("login.html");
    return;
  }

  // 1. Mostrar email
  const userEmailUI = document.getElementById("userEmail");
  if (userEmailUI) userEmailUI.innerText = session.user.email;

  // 2. Obtener perfil
  const { data: profile, error } = await supabase
    .from("p02_profiles")
    .select("role, is_active,status")
    .eq("id", session.user.id)
    .single();

  if (error) {
    console.error("Error al obtener perfil:", error);
    // Si hay error, detenemos
    return;
  }
  const { role, is_active, status } = profile || {};
  window.userRole = role || "vendedor";

  const mainContent = document.getElementById("main-content");
  const waitingArea = document.getElementById("waiting-area");

  // 3. Lógica de Admin
  if (window.userRole === "admin") {
    document.getElementById("btnAdminPanel")?.classList.remove("d-none");
    document.getElementById("btnViewAllLogs")?.classList.remove("d-none");
  }

  // 4. EL CADENERO (Corregido)
  if (status === "rejected") {
    document.body.classList.add("auth-confirmed");
    await Swal.fire({
      icon: "error",
      title: "Acceso Denegado",
      text: "Tu solicitud ha sido rechazada por el administrador. No puedes acceder al sistema.",
      confirmButtonText: "Entendido",
      confirmButtonColor: "#d33",
      allowOutsideClick: false, // Para que no lo cierren haciendo clic fuera
    });
    await supabase.auth.signOut();
    window.location.replace("login.html");
    return;
  }

  if (is_active === true) {
    // CASO: ACTIVO
    mainContent.classList.remove("d-none");
    waitingArea.classList.add("d-none"); // Ocultamos espera
    await loadInventory(); // Solo cargamos si está activo
  } else {
    // CASO: PENDIENTE
    mainContent.classList.add("d-none"); // Ocultamos app
    waitingArea.classList.remove("d-none"); //Mostramos espera

    console.warn("Acceso restringido: Esperando activación.");
  }

  // 5. FINALMENTE: Quitamos el velo de carga
  // Esto debe ir al final para que el usuario solo vea la pantalla definitiva
  document.body.classList.add("auth-confirmed");
}
//EJECUTAMOS
protectPage();

/* ==========================================
   1. ESTADO GLOBAL
   ========================================== */
let editingId = null;
let currentProducts = [];
const filtros = { categorias: "todas", stock: "all" };

/* ==========================================
   2. FUNCIONES DE BASE DE DATOS (API)
   ========================================== */
async function loadInventory() {
  const { data, error } = await supabase
    .from("p02_productos")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) {
    showToast(error.message, "danger");
    return;
  }

  // Guardamos los datos en la variable global
  currentProducts = data || [];

  applyFilters();
  renderCategoryButtons(currentProducts);
  updateFormSelect(currentProducts);
  loadRecentActivity();
}

/* ==========================================
   3. LÓGICA DE INTERFAZ (UI)
   ========================================== */
window.resetForm = () => {
  const formTitle = document.getElementById("formTitle");
  const btnText = document.getElementById("btnText");
  const btnCancel = document.getElementById("btnCancel");
  const btnSubmit = document.getElementById("btnSubmit");
  const form = document.getElementById("productForm");

  //1.Limpiamos todos los inputs del formulario
  form.reset();
  //2.Se limpia el id de edicion para que no crea que seguimos editando
  editingId = null;
  //3.Restaurar Interfaz
  formTitle.innerText = "Registrar Nuevo Producto";
  btnText.innerText = "Guardar Producto";

  //4.Cambiamos el color de amarillo (warning) a azul (Primary)
  btnSubmit.classList.replace("btn-warning", "btn-primary");
  //Escondemos el boton de cancelar
  if (btnCancel) {
    btnCancel.classList.add("d-none");
  }

  const toggleCat = document.getElementById("toggleCategory");
  const selectCat = document.getElementById("category");
  const inputCat = document.getElementById("newCategory");
  if (toggleCat && selectCat && inputCat) {
    toggleCat.checked = false;
    selectCat.classList.remove("d-none");
    inputCat.classList.add("d-none");
  }
};

function updateDashboard(products) {
  const totalValueUI = document.getElementById("totalValue");
  const lowStockCountUI = document.getElementById("lowStockCount");

  const totalValue = products.reduce(
    (acc, item) => acc + item.precio * item.stock,
    0,
  );
  const lowStocksItems = products.filter((item) => item.stock <= 5).length;
  if (totalValueUI) {
    totalValueUI.innerText = `$${totalValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
    })}`;
  }
  if (lowStockCountUI) {
    lowStockCountUI.innerText = lowStocksItems;
  }
}

async function loadRecentActivity() {
  const { data, error } = await supabase
    .from("p02_logs")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error al cargar los logs:", error.message);
    return;
  }
  if (data) {
    renderLogs(data);
  }
}

async function loadAllLogs() {
  const { data, error } = await supabase
    .from("p02_logs")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error al cargar los logs:", error.message);
    Swal.fire("Error", "No se pudo cargar el historial", "error");
    return;
  }
  if (data) {
    renderAuditTable(data);
  }
}

function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function renderAuditTable(logs) {
  const tablaCuerpo = document.getElementById("auditTableBody");
  if (!tablaCuerpo) {
    return;
  }
  tablaCuerpo.innerHTML = "";

  const badges = {
    CREAR: "bg-success",
    EDITAR: "bg-warning text-dark",
    ELIMINAR: "bg-danger",
    "SUMAR STOCK": "bg-info text-dark",
    "RESTAR STOCK": "bg-secondary",
  };

  logs.forEach((log) => {
    const row = document.createElement("tr");
    const badgeClass = badges[log.accion] || "bg-secondary";

    row.innerHTML = `
    <td class="small text-muted">${formatearFecha(log.fecha)}</td>
    <td class="fw-bold text-primary">${log.usuario_email}</td>
    <td><span class="badge ${badgeClass} badge-audit">${log.accion}</span></td>
    <td>${log.producto_nombre}</td>
    `;
    tablaCuerpo.appendChild(row);
  });
}

function renderLogs(logs) {
  const container = document.getElementById("activityLog");
  if (!container) {
    return;
  }
  container.innerHTML = "";

  const diccionario = {
    CREAR: {
      icon: "bi bi-file-earmark-plus-fill",
      color: "text-success",
      mensaje: "Se agrego un nuevo producto",
    },
    EDITAR: {
      icon: "bi bi-file-check-fill",
      color: "text-warning",
      mensaje: "Se actualizo un nuevo producto",
    },
    ELIMINAR: {
      icon: "bi bi-file-earmark-excel-fill",
      color: "text-danger",
      mensaje: "Se elimino permanentemente",
    },
    "SUMAR STOCK": {
      icon: "bi bi-graph-up-arrow",
      color: "text-success",
      mensaje: "Se agrego stock",
    },
    "RESTAR STOCK": {
      icon: "bi-graph-down-arrow",
      color: "text-danger",
      mensaje: "Se resto stock",
    },
    "UNIFICAR CATEGORIAS": {
      icon: "bi bi-union",
      color: "text-info",
      mensaje: "Unificación de categorias",
    },
  };

  logs.forEach((log) => {
    const estilo = diccionario[log.accion] || {
      icon: "bi bi-question-circle",
      color: "secondary",
      mensaje: log.accion,
    };
    const fecha = new Date(log.fecha).toLocaleString();
    const detalleInfo = `
    <div class="text-dark small fw-semibold">
      ${log.producto_nombre || ""} 
    </div>
    ${
      log.affected_rows >= 1
        ? `<div class="mt-1"><span class="badge bg-light text-dark border" style="font-size: 0.75rem;">
          <i class="bi bi-boxes me-1"></i>${log.affected_rows} productos afectados
         </span></div>`
        : ""
    }
  `;
    const li = document.createElement("li");
    li.className = "list-group-item px-0 py-3 border-0 border-bottom";
    li.innerHTML = `
    <div class="d-flex align-items-center">
        <i class="${estilo.icon} ${estilo.color} fs-4 me-3"></i>
        <div>
            <h6 class="mb-0 fw-bold ${estilo.color}" style="font-size:0.9em;">
                ${estilo.mensaje}
            </h6>            
            ${detalleInfo}
            <small class="text-muted d-block mt-1" style="font-size:0.85rem;">
               <i  class="bi bi-calendar2-date"></i> ${fecha}
               <span class="mx-1">•</span><i class="bi bi-person me-1"></i>${log.usuario_email}
            </small>
          </div>
        </div>
           `;

    container.appendChild(li);
  });
}

window.filterAuditTable = () => {
  document.getElementById("btnTodos").checked = true;

  const input = document.getElementById("auditSearch");
  const filter = input.value.toLowerCase();

  const tableBody = document.getElementById("auditTableBody");
  const rows = tableBody.getElementsByTagName("tr");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const rowText = row.textContent.toLowerCase();

    if (rowText.includes(filter)) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  }
};

window.filterByAction = (action) => {
  const tableBody = document.getElementById("auditTableBody");
  const rows = tableBody.getElementsByTagName("tr");
  //Para limpiar el buscador
  document.getElementById("auditSearch").value = "";

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    //La celda accion en la bd es la tercera osea (indice 2)
    const actionCell = row.cells[2];

    if (actionCell) {
      const actionText = actionCell.textContent.trim();
      //logica: si es todos o el texto coincide exactamente con la accion
      if (action === "TODOS" || actionText === action) {
        row.style.display = "";
      } else {
        row.style.display = "none";
      }
    }
  }
  console.log("Filtrando por acción");
};
function applyFilters() {
  // 1. Empezamos con una COPIA de todos los productos
  let filtered = [...currentProducts];

  // 2. Filtro de Categoría
  // Aseguramos que existan datos antes de comparar
  if (filtros.categorias && filtros.categorias.toLowerCase() !== "todas") {
    filtered = filtered.filter(
      (p) => p.categoria && p.categoria === filtros.categorias,
    );
  }
  // 3. Filtro de Stock
  if (filtros.stock === "low") {
    filtered = filtered.filter((p) => p.stock <= 5);
  }

  // 4. Dibujar y Actualizar UI
  renderInventory(filtered);
  updateFilterButtonsUI();

  console.log("Filtros aplicados:", filtros);
  console.log("Productos encontrados:", filtered.length);
}

//Actualizacion visual
function updateFilterButtonsUI() {
  // 1. Manejar botones de Stock
  const btnAll = document.getElementById("btnFilterAll");
  const btnLow = document.getElementById("btnFilterLow");

  if (btnAll && btnLow) {
    if (filtros.stock === "low") {
      // MODO STOCK BAJO ACTIVO
      // El botón de "Todos" se apaga (outline)
      btnAll.classList.remove("btn-dark");
      btnAll.classList.add("btn-outline-dark");

      // El botón de "Stock Bajo" se enciende (Rojo Intenso)
      btnLow.classList.remove("btn-outline-danger");
      btnLow.classList.add("btn-danger", "text-white");
    } else {
      // MODO TODOS ACTIVO
      // El botón de "Todos" se enciende (Negro)
      btnAll.classList.remove("btn-outline-dark");
      btnAll.classList.add("btn-dark");

      // El botón de "Stock Bajo" se apaga (Rojo Claro / Outline)
      btnLow.classList.remove("btn-danger", "text-white");
      btnLow.classList.add("btn-outline-danger");
    }
  }

  const catButtons = document.querySelectorAll("#filterGroup button");
  catButtons.forEach((btn) => {
    // Normalizamos texto para evitar errores de mayúsculas/espacios
    const btnCat = btn.innerText.trim().toLowerCase();
    const currentCat = filtros.categorias.toLowerCase();

    // Si coinciden, le ponemos 'active', si no, se lo quitamos
    if (btnCat === currentCat) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

window.filterByCategory = (catNombre, event) => {
  if (event) event.preventDefault();
  filtros.categorias = catNombre; // 1. Actualizar estado
  applyFilters(); // 2. Ejecutar filtro
};

window["filterList"] = (status) => {
  filtros.stock = status; // 1. Actualizar estado
  applyFilters(); // 2. Ejecutar filtro
};

window["clearAllFilters"] = () => {
  // 1. Reiniciamos el objeto a su estado original
  filtros.categorias = "todas";
  filtros.stock = "all";

  // 2. Limpiamos el buscador visualmente si tenía texto
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";

  // 3. Aplicamos
  applyFilters();
};

function renderInventory(products) {
  const listContainer = document.getElementById("inventoryList");
  if (!listContainer) return;
  listContainer.innerHTML = "";
  //Calculamos los productos con stock bajo para el badge del boton stocj bajo
  const totalLowStock = currentProducts.filter((p) => p.stock <= 5).length;
  const badgeBtn = document.getElementById("badgeLowStock");
  if (badgeBtn) badgeBtn.innerText = totalLowStock;

  // Ordernar siempre alfabeticamente la data que nos llega
  const sortedProducts = products.sort((a, b) =>
    a.nombre.localeCompare(b.nombre),
  );

  if (sortedProducts.length === 0) {
    listContainer.innerHTML =
      '<li class="list-group-item text-center p-4 text-muted">No se encontraron productos con estos filtros.</li>';
    updateDashboard(products); // Actualizar dashboard a 0
    return;
  }

  sortedProducts.forEach((item) => {
    const isLow = item.stock <= 5;
    const li = document.createElement("li");
    const isAdmin = window.userRole === "admin";

    // 2. LA FILA: Siempre limpia y blanca (quitamos el borde rojo)
    li.className =
      "list-group-item d-flex justify-content-between align-items-center p-3 mb-2 shadow-sm border-light rounded-3 gap-3";

    // 3. LOGICA VISUAL: Preparamos las clases
    // Icono: Rojo suave si es bajo, Azul suave si es normal
    const iconBg = isLow
      ? "bg-danger bg-opacity-10 text-danger"
      : "bg-light text-primary";
    const iconName = isLow ? "bi-exclamation-triangle-fill" : "bi-box-seam";
    const nameColor = isLow ? "text-danger" : "text-dark";

    li.innerHTML = `
        <div class="d-flex align-items-start gap-3 overflow-hidden w-100">

            <div class="rounded-circle p-3 me-3 flex-shrink-0 mt-1 ${iconBg}">
                <i class="bi ${iconName} fs-5"></i>
            </div>
            
            <div class="overflow-hidden w-100">
              <h6 class="mb-1 fw-bold ${nameColor}" 
                  style="font-size: 1rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                  ${item.nombre}
                   ${
                     isLow
                       ? `<span class="badge rounded-pill bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 flex-shrink-0" style="font-size: 0.65rem;">Bajo</span>`
                       : ""
                   }  
              </h6>
                       

              <small class="text-muted d-block text-truncate mb-0" style="font-size: 0.85rem;">
                    ${item.categoria}
                </small>

                <div class="d-flex align-items-center gap-2">
                    <span class="fw-bold text-dark small">$${Number(item.precio).toFixed(2)}</span>
                   
                </div>

            </div>
        </div>

        <div class="d-flex flex-column align-items-end justify-content-between ms-2 flex-shrink-0" style="min-height: 80px;">

        <div class="d-flex gap-2 gap-md-4 justify-content-end">
                 <button class="btn btn-action btn-sm px-2" onclick="window.prepareEdit('${item.id}')" title="Editar">
                    <i class="bi bi-pencil-square d-sm-none"></i>
                    <span class="d-none d-md-inline">Editar</span>
                </button>
                ${
                  isAdmin
                    ? `
                <button class="btn btn-action btn-sm px-2 text-danger hover-danger" onclick="window.deleteProduct('${item.id}')" title="Eliminar">
                    <i class="bi bi-trash2 d-sm-none"></i>
                    <span class="d-none d-md-inline">Eliminar</span>
                </button>`
                    : ""
                }
            </div>

            <div class="stock-control bg-light rounded-pill px-2 py-1 border">
                <button class="btn btn-stock p-0" onclick="window.updateStock('${item.id}', -1, '${item.nombre}')">
                    <i class="bi bi-dash"></i>
                </button>
                
                <span class="fw-bold mx-3 ${isLow ? "text-danger" : "text-dark"}" style="min-width: 40px; display: inline-block; text-align: center;">
                    ${item.stock}
                </span>

                <button class="btn btn-stock p-0" onclick="window.updateStock('${item.id}', 1, '${item.nombre}')">
                    <i class="bi bi-plus"></i>
                </button>
            </div>
            
            
        </div>
    `;

    listContainer.appendChild(li);
  });

  // Actualizamos los números del Dashboard (Inversión y Stock Bajo)
  updateDashboard(sortedProducts);
}
/**
 * Muestra una notificación profesional (Toast)
 * @param {string} icon - 'success', 'error', 'warning', 'info'
 * @param {string} title - El mensaje a mostrar
 */
function showNotify(icon, title) {
  const Toast = Swal.mixin({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.onmouseenter = Swal.stopTimer;
      toast.onmouseleave = Swal.resumeTimer;
    },
  });
  Toast.fire({ icon, title });
}

//SWITCH NUEVA CATEGORIA
const toggleCat = document.getElementById("toggleCategory");
const selectCat = document.getElementById("category");
const inputCat = document.getElementById("newCategory");

toggleCat.addEventListener("change", (e) => {
  if (e.target.checked) {
    selectCat.classList.add("d-none"); //OCULTA SELECT
    inputCat.classList.remove("d-none"); //MUESTRA INPUT
    inputCat.focus();
  } else {
    selectCat.classList.remove("d-none"); //MUESTRA SELECT
    inputCat.classList.add("d-none"); //OCULTA INPUT
    inputCat.value = "";
  }
});

async function registrarLog(accion, nombreProducto) {
  const email =
    document.getElementById("userEmail")?.innerText || "Usuario Desconocido";
  const { error } = await supabase.from("p02_logs").insert({
    usuario_email: email,
    accion: accion,
    producto_nombre: nombreProducto,
  });
  if (error) console.error("Error al registrar log:", error.message);
}

/* ==========================================
   4. MANEJO DE EVENTOS
   ========================================== */
async function saveProduct(event) {
  event.preventDefault(); //evita que la pagina se recargue

  validacionCamposSP();

  const btnGuardar = document.getElementById("btnSubmit");
  if (btnGuardar.disabled) {
    console.warn("Intento de guardado bloqueado: Datos invalidos");
    return;
  }
  //1. Capturamos los valores
  const name = document.getElementById("name").value;
  let categoryFinal;
  if (document.getElementById("toggleCategory").checked) {
    categoryFinal = document.getElementById("newCategory").value.trim();
    if (!categoryFinal)
      return Swal.fire("Error", "Escribe una categoría", "error");
  } else {
    categoryFinal = document.getElementById("category").value;
  }
  const stock = document.getElementById("stock").value;
  const price = document.getElementById("price").value;

  const btnSubmit = document.getElementById("btnSubmit");
  const btnText = document.getElementById("btnText");
  const btnSpinner = document.getElementById("btnSpinner");

  //2.Estado de carga (Feedback visual profesional)
  btnSubmit.disabled = true;
  btnSpinner.classList.remove("d-none");
  btnText.innerText = "Guardando...";

  try {
    const productData = {
      nombre: name,
      categoria: categoryFinal,
      stock: parseInt(stock),
      precio: parseFloat(price),
    };

    let result;

    if (editingId) {
      //MODO EDICION: Actualizamos donde el id coincida
      result = await supabase
        .from("p02_productos")
        .update(productData)
        .eq("id", editingId);
      showNotify("success", "¡Producto actualizado con éxito!");
    } else {
      //MODO CREACION:Insertamos nuevo registro
      result = await supabase.from("p02_productos").insert([productData]);
    }
    if (result.error) throw result.error;
    await registrarLog(editingId ? "EDITAR" : "CREAR", name);
    //4.Si todo sale bien, limpiamos
    showNotify("success", "¡Producto registrado correctamente!");
    resetForm();
  } catch (error) {
    console.error("Error al guardar:", error.message);
    showNotify("error", "Hubo un problema: " + error.message);
  } finally {
    //5.Restauramos el boton
    btnSubmit.disabled = false;
    btnSpinner.classList.add("d-none");
    btnText.innerText = editingId ? "Actualizar Producto" : "Guardar Producto";

    loadInventory();
    categoryManegement();
  }
}

const loadAdminData = document.getElementById("adminModal");
loadAdminData.addEventListener("show.bs.modal", async () => {
  if (window.userRole === "admin") {
    console.log("Acceso concedido");
    fetchPendingUsers();
  } else {
    console.log("Acceso denegado");
  }
});

async function categoryManegement() {
  //Pedimos los 3 datos claves a supabase
  const { data, error } = await supabase
    .from("p02_productos")
    .select("categoria, precio, stock");
  if (error) {
    console.error("Error al obtener categorias:", error);
    return;
  }
  //creamos un objeto anidado/estructurado
  const stats = {};
  data.forEach((item) => {
    const cat = item.categoria ? item.categoria.trim() : "Sin categoria";
    //Si la categoria no existe en nuestro diccionario estructurado la inicializamos con sus compartimentos
    if (!stats[cat]) {
      stats[cat] = {
        cantidad: 0,
        inversion: 0,
      };
    }
    //Llenamos la informacion, sumamos 1 al conteo de productos
    stats[cat].cantidad += 1;
    //Sumamos el resultado de la multiplicacion al total de la inversion
    stats[cat].inversion += Number(item.precio) * Number(item.stock);
  });

  const tableBody = document.getElementById("categoryManegementTab");
  if (!tableBody) return;
  //Convertimos el objeto en una lista (Array) ordenamos por nombre
  const tableData = Object.entries(stats).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  //Dibujamos las filas con el nuevo formato
  const html = tableData
    .map(
      ([nombre, info]) =>
        `<tr>
    <td>${nombre}</td>
    <td class="text-center text-md-start"><span class="badge bg-secondary">${info.cantidad}</span></td>
    <td class="text-end fw-bold text-primary">
        $${info.inversion.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </td>
    <td>

    <div class="d-flex justify-content-center">

    <button class="btn btn-primary btn-sm" onclick="unifyCategory('${nombre}')" title="Editar">
        <i class="bi bi-pencil-square d-md-none"></i>
        <span class="d-none d-md-inline">Editar</span>
    </button>

</div>
    </td>
    </tr>`,
    )
    .join(``);
  tableBody.innerHTML = html;
}
categoryManegement();
window.categoryManegement = categoryManegement;

async function unifyCategory(oldName) {
  const { data: categoriesData, error } = await supabase
    .from("p02_productos")
    .select("categoria");
  if (error) {
    console.error("Error al obtener categorias:", error);
    return;
  }

  const categoriesClean = [
    ...new Set(categoriesData.map((cat) => cat.categoria)),
  ]
    .filter((c) => c !== oldName)
    .sort();

  if (categoriesClean.length === 0) {
    Swal.fire(
      "Aviso",
      "No hay otras categorías disponibles para unificar.",
      "info",
    );
    return;
  }

  const optionsList = {};
  categoriesClean.forEach((cat) => {
    optionsList[cat] = cat;
  });

  optionsList["NEW_CUSTOM_CATEGORY"] = "Crear nueva categoría...";

  let { value: selectedCategory } = await Swal.fire({
    title: `Mover los productos de "${oldName}" a:`,
    text: "Selecciona el destino o crea uno nuevo",
    input: "select",
    inputOptions: optionsList,
    inputPlaceholder: "Selecciona una opción",
    showCancelButton: true,
    confirmButtonText: "Continuar",
    confirmButtonColor: "#0d6efd",
    cancelButtonText: "Cancelar",
    // IMPORTANTE: Esto arregla el foco si Bootstrap se pone pesado
    target: document.getElementById("adminModal") || "body",
    inputValidator: (value) => {
      if (!value) return "Debes seleccionar una opción";
    },
  });

  if (!selectedCategory) return;
  let finalCategoryName = selectedCategory;

  if (selectedCategory === "NEW_CUSTOM_CATEGORY") {
    // --- SEGUNDA ALERTA: SOLO APARECE SI QUIERE CREAR NUEVA ---
    const { value: typedCategory } = await Swal.fire({
      title: "Nueva Categoría",
      input: "text",
      inputLabel: "Escribe el nombre de la nueva categoría",
      inputPlaceholder: "Ej: Ofertas de Verano",
      showCancelButton: true,
      confirmButtonText: "Usar este nombre",
      target: document.getElementById("adminModal") || "body", // Fix de foco
      inputValidator: (value) => {
        if (!value) return "¡El nombre no puede estar vacío!";
      },
    });

    if (!typedCategory) return;

    finalCategoryName = typedCategory.trim();
  }

  const { count, error: countError } = await supabase
    .from("p02_productos")
    .select("*", { count: "exact", head: true })
    .eq("categoria", oldName);
  if (countError) {
    console.log("Error al obtener los datos", countError.message);
  }
  const cantidad = count || 0;

  const result = await Swal.fire({
    title: "¿Estás seguro?",
    text: `Moveras ${cantidad} productos de "${oldName}" a "${finalCategoryName}".`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33", // Un rojo para peligro
    cancelButtonColor: "#6c757d",
    confirmButtonText: `Confirmar ${cantidad}`,
    cancelButtonText: "Cancelar",
  });

  if (result.isConfirmed) {
    const { error } = await supabase
      .from("p02_productos")
      .update({ categoria: finalCategoryName })
      .eq("categoria", oldName);
    if (error) {
      console.error("Error al unificar:", error.message);
      Swal.fire("Error", "No se pudo actualizar", "error");
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // await supabase.from("p02_logs").insert({
    const { error: logError } = await supabase.from("p02_logs").insert({
      usuario_email: user.email,
      accion: "UNIFICAR CATEGORIAS",
      affected_rows: cantidad,
      producto_nombre: oldName,
      descripcion_text: `${oldName} a ${finalCategoryName}`,
      fecha: new Date().toISOString(),
    });
    if (logError) {
      console.error(
        "DETALLE DEL ERROR 400:",
        logError.message,
        logError.details,
        logError.hint,
      );
    }
    Swal.fire(
      "¡Unificado!",
      `Los productos ahora están en "${finalCategoryName}".`,
      "success",
    );
    categoryManegement();
    loadInventory();
  }
}
window.unifyCategory = unifyCategory;

async function fetchPendingUsers() {
  const { data, error } = await supabase
    .from("p02_profiles")
    .select("*")
    .eq("status", "pending");
  if (error) {
    console.error("Error al consultar", error.message);
    return;
  }
  const pendingUsersTable = document.getElementById("pendingUsersTable");
  if (!pendingUsersTable) {
    console.log("No se encontro la tabla pendingUsersTable en esta pagina");
    return;
  }
  // console.log("Usuarios:", data);
  pendingUsersTable.innerHTML = "";
  if (data.length === 0) {
    pendingUsersTable.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No hay usuarios pendientes de aprobación.</td></tr>`;
    return;
  }

  data.forEach((user) => {
    const row = document.createElement("tr");
    row.className = "align-middle";
    row.innerHTML = `
 <td style="max-width: 150px;">
    <div class="text-truncate" title="${user.email}">
      ${user.email}
    </div>
 </td>

 <td style="width: 80px;">
        <span class="badge ${user.role === "admin" ? "bg-danger" : "bg-secondary"} " style="font-size: 0.7rem;">
          ${user.role}
        </span>
      </td>

 <td style="width: 110px;">
      <div class="d-flex gap-1 justify-content-end">

          <button class="btn btn-primary btn-sm px-2" onclick="activateUser('${user.id}')" title="Activar">
                <i class="bi bi-check-lg d-md-none"></i>
                <span class="d-none d-md-inline">Activar</span>
            </button>

          <button class="btn btn-danger btn-sm px-2" onclick="rejectUser('${user.id}')" title="Rechazar">
                <i class="bi bi-x-lg d-md-none"></i>
                <span class="d-none d-md-inline">Rechazar</span>
          </button>

      </div>
    </td>
    `;
    pendingUsersTable.appendChild(row);
  });
}

async function activateUser(userId) {
  Swal.fire({
    title: "¿Estás seguro?",
    text: "¡Vas a activar a este usuario!",
    icon: "warning",
    showCancelButton: true, // Muestra el botón de "Cancelar"
    confirmButtonColor: "#0d6efd", // Verde de Bootstrap (Success)
    cancelButtonColor: "#d33", // Rojo de Bootstrap (Danger)
    confirmButtonText: "Activar",
    cancelButtonText: "Cancelar",
  }).then(async (result) => {
    // Esta parte se ejecuta después de que el usuario hace clic
    if (result.isConfirmed) {
      const { error } = await supabase
        .from("p02_profiles")
        .update({
          is_active: true,
          status: "active",
        })
        .eq("id", userId);
      console.log("El usuario confirmó, ejecutando actualización...");

      if (error) {
        Swal.fire("Error", "No se pudo activar: " + error.message, "error");
      } else {
        await Swal.fire({
          icon: "success",
          title: "¡Logrado!",
          text: "El usuario ha sido activado correctamente.",
          showConfirmButton: false, // Escondemos el botón para que se vea más limpio
          timer: 1500, // Se cierra solo en 1.5 segundos
        });
        fetchPendingUsers();
      }
    }
  });
}
window.activateUser = activateUser;

async function rejectUser(userId) {
  const result = await Swal.fire({
    title: "Eliminar Solicitud",
    text: "¿Estás seguro de rechazar este usuario?",
    icon: "warning",
    showCancelButton: true, // Muestra el botón de "Cancelar"
    confirmButtonColor: "#0d6efd", // Verde de Bootstrap (Success)
    cancelButtonColor: "#d33", // Rojo de Bootstrap (Danger)
    confirmButtonText: "Eliminar",
    cancelButtonText: "Cancelar",
  });
  // Esta parte se ejecuta después de que el usuario hace clic
  if (result.isConfirmed) {
    const { error } = await supabase
      .from("p02_profiles")
      .update({ is_active: false, status: "rejected" })
      .eq("id", userId);

    if (error) {
      Swal.fire("Error", "No se pudo eliminar: " + error.message, "error");
    } else {
      Swal.fire("Eliminado", "Usuario enviado ala lista negra", "success");
      fetchPendingUsers();
    }
  }
}
window.rejectUser = rejectUser;

function validacionCamposSP() {
  console.log("Validando...");

  const stock = document.getElementById("stock");
  const precio = document.getElementById("price");
  const btnGuardar = document.getElementById("btnSubmit");

  const valorStock = Number(stock.value);
  const valorPrecio = Number(precio.value);

  const stockEsInvalido = stock.value === "" || valorStock < 0;
  const precioEsInvalido = precio.value === "" || valorPrecio <= 0;

  if (stockEsInvalido) stock.classList.add("is-invalid");
  else stock.classList.remove("is-invalid");

  if (precioEsInvalido) precio.classList.add("is-invalid");
  else precio.classList.remove("is-invalid");

  btnGuardar.disabled = stockEsInvalido || precioEsInvalido;
}

//Escuchador del formulario
document.getElementById("productForm").addEventListener("submit", saveProduct);
//Escuchador de carga inicial
document.addEventListener("DOMContentLoaded", loadInventory);
//Escuchador validacion inputs
document.getElementById("stock").addEventListener("input", validacionCamposSP);
document.getElementById("price").addEventListener("input", validacionCamposSP);

const btnLogs = document.getElementById("btnViewAllLogs");
if (btnLogs) {
  btnLogs.addEventListener("click", () => {
    loadAllLogs();
  });
}

window.updateStock = async (id, cantidad, nombreProducto) => {
  const { data: producto, error: errorFetch } = await supabase
    .from("p02_productos")
    .select("stock")
    .eq("id", id)
    .single();
  if (errorFetch) return console.error(errorFetch);

  const nuevoStock = producto.stock + cantidad;
  //evitar stock negativo
  if (nuevoStock < 0) {
    Swal.fire("Aviso", "El stock no puede ser menor a cero", "warning");
    return;
  }

  //Actualizar en supabase
  const { error: errorUpdate } = await supabase
    .from("p02_productos")
    .update({ stock: nuevoStock })
    .eq("id", id);
  if (errorUpdate) {
    Swal.fire("Error", "No se pudo actualizar el stock", "error");
  } else {
    //Registrar movimiento en auditoria
    const accion = cantidad > 0 ? "SUMAR STOCK" : "RESTAR STOCK";
    await registrarLog(accion, nombreProducto);

    loadInventory();
  }
};

function renderCategoryButtons(products) {
  const filterGroup = document.getElementById("filterGroup");
  const firstButton = filterGroup.firstElementChild;
  filterGroup.innerHTML = "";
  filterGroup.appendChild(firstButton);

  // 1. Extraer categorías únicas usando un Set (un Set no permite duplicados)
  const categories = [...new Set(products.map((p) => p.categoria))];
  // 2. Crear un botón por cada categoría encontrada
  categories.forEach((cat) => {
    if (!cat) return; // Saltar si la categoría está vacía

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-outline-primary rounded-pill flex-shrink-0";
    btn.innerText = cat;
    // Le asignamos la función que ya creamos antes
    btn.onclick = (event) => filterByCategory(cat, event);
    filterGroup.appendChild(btn);
  });
}

function updateFormSelect(products) {
  const select = document.getElementById("category");
  if (!select) return;

  const currentVal = select.value;

  const uniqueCategories = [
    ...new Set(products.map((p) => p.categoria)),
  ].filter((c) => c);

  select.innerHTML =
    '<option value="" selected disabled>Seleccione una categoría</option>';

  uniqueCategories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  });

  if (uniqueCategories.includes(currentVal)) {
    select.value = currentVal;
  }
}

window.handleSearch = (event) => {
  const searchTerm = event.target.value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  //Si el buscador esta vacio, mostramos todos los productos
  if (!searchTerm) {
    renderInventory(currentProducts);
    return;
  }
  //filtramos sobre la lista completa y normalizamos el nombre del producto o categoria
  const filtered = currentProducts.filter((p) => {
    const name = (p.nombre || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const category = (p.categoria || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    //Retorna verdadero si el termino esta en el nombre 0 en la categoria
    return name.includes(searchTerm) || category.includes(searchTerm);
  });
  if (filtered.length === 0) {
    const tableBody = document.getElementById("inventoryList"); // Ajusta al ID de tu tabla
    if (tableBody) {
      tableBody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center py-5 px-4">
          <div class="mx-auto" style="max-width: 350px;">
            <i class="bi bi-search d-block mb-2 text-muted opacity-50" style="font-size: 2rem;"></i>
            
            <p class="text-muted mb-3">
              No existe producto que coincida con <strong>"${event.target.value}"</strong>. 
              Intenta con otras palabras.
            </p>

            <button class="btn btn-sm btn-primary shadow-sm mb-3" onclick="resetSearch()">
              <i class="bi bi-arrow-counterclockwise"></i> Limpiar filtros
            </button>
          </div>
        </td>
      </tr>`;
      return;
    }
  }
  renderInventory(filtered);
};

// const btnLogout = document.getElementById("btnLogout");

window.handleLogout = async () => {
  try {
    document.body.innerHTML = `
      <div class="vh-100 d-flex justify-content-center align-items-center bg-light">
        <p class="text-muted">Cerrando sesión de forma segura...</p>
      </div>
    `;

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    window.location.replace("login.html");
  } catch (error) {
    console.error("Error al cerrar sesión:", error.message);
    Swal.fire("Error", "No se pudo cerrar la sesión correctamente", "error");
    window.location.reload();
  }
};
// if (btnLogout) {
//   btnLogout.addEventListener("click", handleLogout);
// }
/**
 * Genera un PDF profesional con los productos que tienen stock <= 5
 */
window.generateLowStockReport = () => {
  // 1. Verificación de seguridad
  if (!currentProducts || currentProducts.length === 0) {
    showNotify("info", "No hay productos para analizar");
    return;
  }
  //2.Filtrar productos con bajo stock
  const lowStocksItems = currentProducts.filter((p) => p.stock <= 5);
  if (lowStocksItems.length === 0) {
    Swal.fire({
      title: "¡Todo en orden!",
      Text: "No tienes productos con bajo stock en este momento.",
      icon: "success",
    });
    return;
  }
  //3.Crear el PDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  //Titulo y encabezado
  doc.setFontSize(18);
  doc.setTextColor(220, 53, 69);
  doc.text("REPORTE DE PRODUCTOS CON STOCK BAJO", 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generando el: ${new Date().toLocaleString()}`, 14, 35);
  //4.Generar la tabla
  const rows = lowStocksItems.map((p) => [
    p.nombre,
    p.categoria,
    `${p.stock} unidades`,
    `$${Number(p.precio).toFixed(2)}`,
  ]);
  doc.autoTable({
    startY: 40,
    head: [["producto", "Categoria", "Stock Actual", "Precio Unit."]],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: [220, 53, 69] }, //Rojo profesional
    styles: { fontSize: 10 },
  });
  //Descargar
  doc.save(`Reporte_Bajo_Stock_${new Date().getTime().pdf}`);
  showNotify("Success", "Reporte generado con exito");
};

/* ==========================================
   5. CONEXIÓN REALTIME
   ========================================== */
supabase
  .channel("cambios-inventario")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "p02_productos" },
    (payload) => {
      console.log("Cambio detectado:", payload);
      loadInventory(); // Esta función vuelve a pedir los datos
    },
  )
  .subscribe();

/* ==========================================
   6. EXPOSICIÓN GLOBAL (Para HTML onclick)
   ========================================== */
//Hacer funciones accesibles globalmente para los botones generados dinamicamente
window.prepareEdit = (id) => {
  // 1. Buscamos el producto en nuestro array local
  const item = currentProducts.find((p) => p.id == id);
  if (!item) return;

  //Arreglo del error visual
  toggleCat.checked = false; //apagamos el switch
  selectCat.classList.remove("d-none");
  inputCat.classList.add("d-none");
  inputCat.value = "";

  // 2. Activamos el modo edición
  editingId = id;
  // 3. Llenamos el formulario
  document.getElementById("name").value = item.nombre;
  document.getElementById("category").value = item.categoria;
  document.getElementById("stock").value = item.stock;
  document.getElementById("price").value = item.precio;

  // 4. Cambiamos la interfaz
  document.getElementById("formTitle").innerText = "Editando Producto";
  document.getElementById("btnText").innerText = "Actualizar Producto";

  const btnSubmit = document.getElementById("btnSubmit");
  btnSubmit.classList.replace("btn-primary", "btn-warning");

  document.getElementById("btnCancel").classList.remove("d-none");

  // 5. Scroll suave al formulario
  window.scrollTo({ top: 0, behavior: "smooth" });
};

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-eliminar");

  if (btn) {
    const id = btn.dataset.id;
    const nombre = btn.dataset.nombre;

    console.log("Eliminando:", nombre, "con ID:", id);
    deleteProduct(id, nombre); // <--- Usas el ID, que es infalible
  }
});

window.deleteProduct = async (id) => {
  const item = currentProducts.find((p) => p.id == id);
  const nombreReal = item ? item.nombre : "este producto";

  const result = await Swal.fire({
    title: `¿Eliminar ${nombreReal}?`,
    text: "Esta acción no se puede deshacer",
    icon: "warning",
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    showCancelButton: true,
    confirmButtonText: "Eliminar",
    cancelButtonText: "Cancelar",
  });
  if (result.isConfirmed) {
    const { error } = await supabase
      .from("p02_productos")
      .delete()
      .eq("id", id);

    if (!error) {
      await registrarLog("ELIMINAR", nombreReal);
      loadInventory();
      showNotify("success", "Producto eliminado");
      loadInventory();
    }
  }
};

// Seleccionamos el contenedor de las categorías
const filterGroup = document.getElementById("filterGroup");

if (filterGroup) {
  filterGroup.addEventListener(
    "wheel",
    (event) => {
      // Si el usuario mueve la rueda del ratón...
      if (event.deltaY !== 0) {
        // Evitamos que la página suba o baje
        event.preventDefault();

        // Convertimos el movimiento vertical (deltaY) en movimiento horizontal (scrollLeft)
        filterGroup.scrollLeft += event.deltaY;
      }
    },
    { passive: false },
  );
}
