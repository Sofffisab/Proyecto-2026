-- CreateTable
CREATE TABLE "persona" (
    "id" SERIAL NOT NULL,
    "mail" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "contrasenia" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "foto_perfil" BYTEA,

    CONSTRAINT "persona_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "persona_mail_key" ON "persona"("mail");

-- CreateIndex
CREATE UNIQUE INDEX "persona_usuario_key" ON "persona"("usuario");
