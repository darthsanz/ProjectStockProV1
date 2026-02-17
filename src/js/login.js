import { supabase } from "../services/supabase";

/* ==========================================
   AUTO-COMPLETADO DE EMAIL (UX)
   ========================================== */
function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);

  const savedEmail = params.get("email");

  if (savedEmail) {
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");

    if (emailInput) {
      emailInput.value = savedEmail;

      // setTimeout(() => {
      if (passwordInput) passwordInput.focus();
      // }, 100);
    }
  }
}
checkUrlParams();

async function redirectIfLogged() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    // Si YA HAY sesión, no hagas login, vete al dashboard
    window.location.replace("index.html");
  }
  // Si no hay sesión, no hacemos nada (el usuario ve el formulario)
}
redirectIfLogged();

//Splash Screen
const manejarSplash = () => {
  const splash = document.getElementById("splash-screen");
  if (!splash) return;

  //Animacion de salida
  setTimeout(() => {
    splash.classList.add("splash-hidden");
    setTimeout(() => splash.remove(), 800);
  }, 2000);
};
//Es la primera vez?
if (!localStorage.getItem("loaderPresentado")) {
  if (document.readyState === "complete") {
    //ya se cargo todo?
    manejarSplash(); //Si ya, ejecuta animacion
  } else {
    //Si no, esperamos al evento load para ejecutar animacion
    window.addEventListener("load", manejarSplash);
  }
  localStorage.setItem("loaderPresentado", "true");
} else {
  //si ya se vio boramos el splash para no estorbar
  const splash = document.getElementById("splash-screen");
  if (splash) splash.remove();
}

//1.CAPTURA DE ELEMENTOS DEL DOM
const loginForm = document.getElementById("loginForm");
const btnLogin = document.getElementById("btnLogin");
const btnText = document.getElementById("btnText");
const btnSpinner = document.getElementById("btnSpinner");

//2.FUNCION PARA MANEJAR EL INICIO DE SESION
async function handleLogin(event) {
  event.preventDefault(); //Evita que la pagina se recargue

  //Capturamos los valores actuales de los imputs
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  //Feedback visual: Bloqueamos el boton y mostramos el spinner
  setloading(true);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    if (error) throw error;
    //Si llegamos aqui, el login fue exitoso
    //Supabase guarda la sesion automaticamente en el LocalStorage
    console.log("Sesión iniciada correctamente para:", data.user.email);
    window.location.href = "index.html";
  } catch (error) {
    //Depuracion:Explicamos el error al usuario
    //Usamos SweetAlert2
    Swal.fire({
      title: "Error de acceso",
      text: translateError(error.message),
      icon: "error",
      confirmButtonColor: "#0d6efd",
    });
  } finally {
    setloading(false);
  }
}

//3.FUNCIONES AUXILIARES (Refactorizacion)

//Maneja el estado visual del boton
function setloading(isLoading) {
  btnLogin.disabled = isLoading;
  if (isLoading) {
    btnText.classList.add("d-none");
    btnSpinner.classList.remove("d-none");
  } else {
    btnText.classList.remove("d-none");
    btnSpinner.classList.add("d-none");
  }
}

//Traduce errores comunes para mejorar la UX
function translateError(msg) {
  if (msg.includes("Invalid login credentials"))
    return "Correo o contraseña incorrectos.";
  if (msg.includes("Email not confirmed"))
    return "Por favor, confirma tu correo electronico. ";
  return "Ocurrio un error inesperado. Inténtalo de nuevo.";
}
//4.ESCUCHADORES DE EVENTOS
loginForm.addEventListener("submit", handleLogin);
