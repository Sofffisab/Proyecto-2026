const botones = document.querySelectorAll(".btn");

botones.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const menu = btn.nextElementSibling;
    menu.classList.toggle("active");

    const flecha3 = btn.querySelector(".img3");
    if (flecha3) {
      flecha3.classList.toggle("rotada");
    }

    const flecha6 = btn.querySelector(".img6");
    if (flecha6) {
      flecha6.classList.toggle("rotada");
    }

    e.stopPropagation();
  });
});

document.addEventListener("click", () => {
  document.querySelectorAll(".menu").forEach(menu => {
    menu.classList.remove("active");
  });

  document.querySelectorAll(".img3").forEach(flecha => {
    flecha.classList.remove("rotada");
  });

  document.querySelectorAll(".img6").forEach(flecha => {
    flecha.classList.remove("rotada");
  });
});

document.querySelectorAll(".dropdown").forEach(drop => {
  drop.addEventListener("click", (e) => {
    e.stopPropagation();
  });
});

document.querySelectorAll(".dropdown").forEach(dropdown => {
  const input = dropdown.querySelector("input");
  const texto = dropdown.querySelector(".Texto");

  if (input && texto) {
    input.addEventListener("input", () => {
      texto.textContent = input.value;
    });
  }
});

document.querySelectorAll(".dropdown").forEach(dropdown => {
  const input = dropdown.querySelector("input");
  const texto = dropdown.querySelector(".Texto");
  const menu = dropdown.querySelector(".menu");

  if (input && texto) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();

        texto.textContent = input.value; // guarda el texto
        menu.classList.remove("active"); // cierra el menú
      }
    });
  }
});


document.querySelectorAll(".input-container").forEach(container => {
  const input = container.querySelector("input");
  const vacio = container.querySelector(".icono-vacio");
  const check = container.querySelector(".icono-check");

  input.addEventListener("input", () => {
    if (input.value.trim() !== "") {
      vacio.style.display = "none";
      check.style.display = "block";
    } else {
      vacio.style.display = "block";
      check.style.display = "none";
    }
  });
});
document.querySelectorAll(".input-container").forEach(container => {
  const input = container.querySelector("input");
  const vacio = container.querySelector(".icono-check");
  const check = container.querySelector(".icono-vacio");

  // Estado inicial
  vacio.style.display = "block";
  check.style.display = "none";

  input.addEventListener("input", () => {
    if (input.value.trim() === "") {
      vacio.style.display = "block";
      check.style.display = "none";
    } else {
      vacio.style.display = "none";
      check.style.display = "block";
    }
  });
});

const inputCorreo = document.querySelector(".correo");
const errorCorreo = document.querySelector(".error-email");

inputCorreo.addEventListener("input", () => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (inputCorreo.value.trim() === "") {
    errorCorreo.style.display = "none";
    inputCorreo.classList.remove("input-error");
  } else if (!regex.test(inputCorreo.value)) {
    errorCorreo.style.display = "block";
    inputCorreo.classList.add("input-error");
  } else {
    errorCorreo.style.display = "none";
    inputCorreo.classList.remove("input-error");
  }
}); 