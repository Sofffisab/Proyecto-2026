const input = document.getElementById("tituloInput");
const cantidad = document.getElementById("cantidad");
const vacio = document.querySelector(".icono-vacio");
const check = document.querySelector(".icono-check");

input.addEventListener("input", () => {
    cantidad.textContent = input.value.length;

    if (input.value.trim() !== "") {
        vacio.style.display = "none";
        check.style.display = "block";
    } else {
        vacio.style.display = "block";
        check.style.display = "none";
    }
});