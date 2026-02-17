import { supabase } from "../services/supabase.js";

const signupForm = document.getElementById("signupForm");

async function handleSignUp(event) {
  event.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (password !== confirmPassword) {
    swal.fire("Error", "Las contraseñas no coinciden", "error");
    return;
  }
  setLoading(true);
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });
    if (error) throw error;

    swal
      .fire({
        title: "¡Registro Exitoso!",
        text: "Revisa tu correo para confirmar la cuenta (si está activo) o intenta iniciar sesión.",
        icon: "success",
      })
      .then(() => {
        const emailSeguro = encodeURIComponent(email);
        window.location.replace(`login.html?email=${emailSeguro}`);
      });
  } catch (error) {
    swal.fire("Error de Registro", error.message, "error");
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  const btn = document.getElementById("btnSignup");
  const text = document.getElementById("btnText");
  const spinner = document.getElementById("btnSpinner");

  btn.disabled = isLoading;
  text.classList.toggle("d-none", isLoading);
  spinner.classList.toggle("d-none", !isLoading);
}
signupForm.addEventListener("submit", handleSignUp);
