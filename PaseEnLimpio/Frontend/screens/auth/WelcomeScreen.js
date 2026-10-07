import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
 
/**
 * Pantalla de bienvenida.
 * Es la pantalla previa al login: título, foto con círculos decorativos
 * y el botón "Iniciar sesión".
 *
 * Ajustada sobre la referencia de Figma:
 * - Sin contenedor/caja rectangular detrás de los círculos: la foto y
 *   los círculos flotan directamente sobre el fondo de la pantalla.
 * - Círculos reubicados: más grandes, pegados al borde izquierdo y
 *   superpuestos entre sí y con la foto (no encerrados en una caja).
 * - La línea decorativa va debajo de "progreso" (alineada a la derecha
 *   del bloque de texto), no debajo de "Organiza tu".
 * - Botón "Iniciar sesión" con esquinas redondeadas moderadas, no en
 *   forma de píldora completa.
 *
 * @param {function} onIniciarSesion - se ejecuta al presionar "Iniciar sesión"
 *   (normalmente navega hacia LoginScreen).
 */
export default function WelcomeScreen({ onIniciarSesion }) {
  return (
    <View style={styles.container}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>
          <Text style={styles.titleDark}>Entrena mejor.{'\n'}Organiza tu </Text>
          <Text style={styles.titleTeal}>progreso.</Text>
        </Text>
        <View style={styles.underline} />
      </View>
 
      <View style={styles.photoWrapper}>
        <View style={[styles.circle, styles.circleBig]} />
        <View style={[styles.circle, styles.circleSmall]} />
        <View style={styles.photoCircle}>
          <Image
            source={require('../../assets/Gemini_Generated_Image_5twfh55twfh55twf 1.png')}
            style={styles.mujer}
            resizeMode="cover"
          />
        </View>
      </View>
 
      <Pressable
        style={({ pressed }) => [styles.boton, pressed && styles.pressed]}
        onPress={onIniciarSesion}
      >
        <Text style={styles.botonTexto}>Iniciar sesión</Text>
      </Pressable>
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 24,
    paddingTop: 48,
  },
 
  textBlock: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  titleDark: {
    color: '#373D45',
  },
  titleTeal: {
    color: '#177E89',
  },
  // Alineada bajo "progreso": se empuja hacia la derecha del bloque.
  underline: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#177E89',
    opacity: 0.6,
    marginTop: 8,
    alignSelf: 'flex-end',
    marginRight: 8,
  },
 
  // Sin caja/contenedor: los círculos y la foto flotan libres.
  photoWrapper: {
    height: 320,
    justifyContent: 'center',
    position: 'relative',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#177E89',
  },
  circleBig: {
    width: 210,
    height: 210,
    left: -40,
    top: 30,
    opacity: 0.35,
  },
  circleSmall: {
    width: 150,
    height: 150,
    left: 10,
    top: 130,
    opacity: 0.65,
  },
  // La foto va recortada en círculo, apoyada sobre los círculos de atrás.
  photoCircle: {
    width: 250,
    height: 250,
    borderRadius: 125,
    overflow: 'hidden',
    alignSelf: 'center',
    marginLeft: 60,
    backgroundColor: '#FFFFFF',
  },
  mujer: {
    width: '100%',
    height: '100%',
  },
 
  // Radio moderado, no forma de píldora.
  boton: {
    backgroundColor: '#177E89',
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  botonTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
 
  pressed: {
    opacity: 0.85,
  },
});
 