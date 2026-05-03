# De Web a React Native con Expo — Guía práctica

---

## 1. El archivo de entrada

**En web** creás un archivo `index.html` y ahí empieza todo.

**En React Native con Expo**, el punto de entrada es `App.js` (o `app/index.jsx` si usás Expo Router). No existe el HTML. Todo lo que renderizás es código JavaScript.

```javascript
// App.js — esto es tu "index.html"
import { View, Text } from 'react-native';

export default function App() {
  return (
    <View>
      <Text>Hello world</Text>
    </View>
  );
}
```

---

## 2. Las etiquetas HTML no existen — usás componentes

En web usás etiquetas como `<div>`, `<p>`, `<img>`. En React Native esas etiquetas **no existen**. En su lugar importás componentes de `react-native`.

| Web (HTML) | React Native
|-----|-----
| `<div>` | `<View>`
| `<p>`, `<span>`, `<h1>` | `<Text>`
| `<img>` | `<Image>`
| `<input>` | `<TextInput>`
| `<button>` | `<TouchableOpacity>` o `<Pressable>`
| `<ul>` + `<li>` | `<FlatList>`
| `<a>` | `<TouchableOpacity>` + navegación


**Ejemplo concreto:**

```html
<!-- Web -->
<div>
  <h1>My App</h1>
  <p>Welcome!</p>
</div>
```

```javascriptreact
// React Native
import { View, Text } from 'react-native';

<View>
  <Text style={{ fontSize: 24, fontWeight: 'bold' }}>My App</Text>
  <Text>Welcome!</Text>
</View>
```

> **Regla de oro:** Si en web usarías un `<div>` para contener cosas, en React Native usás `<View>`. Si querés mostrar texto, siempre dentro de `<Text>`.



---

## 3. El CSS cambia completamente

En web escribís un archivo `.css` separado o usás clases. **En React Native no existe el CSS**. Los estilos se escriben en JavaScript como objetos, usando `StyleSheet`.

**En web:**

```css
/* styles.css */
.container {
  display: flex;
  flex-direction: column;
  background-color: #1a1a1a;
  padding: 16px;
}
```

**En React Native:**

```javascript
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#1a1a1a',
    padding: 16,          // sin "px", solo el número
  },
});
```

Y lo aplicás así:

```javascriptreact
<View style={styles.container}>
  ...
</View>
```

**Diferencias clave con CSS:**

| CSS Web | React Native StyleSheet
|-----|-----
| `background-color` | `backgroundColor` (camelCase)
| `font-size: 16px` | `fontSize: 16`
| `margin-top: 8px` | `marginTop: 8`
| `display: flex` | es flex **por defecto**, no hace falta
| `flex-direction: row` | `flexDirection: 'row'`
| Clases con `.nombre` | objetos con `styles.nombre`
| Herencia de estilos | **No hay herencia.** Cada componente tiene sus propios estilos


---

## 4. Flexbox es el default

En web, un `<div>` por defecto es `block`. En React Native, **todo es Flexbox por defecto** y la dirección es `column` (vertical). No necesitás escribir `display: flex`.

```javascriptreact
// Esto ya es flex column sin escribirlo explícitamente
<View style={{ flex: 1 }}>
  <Text>Arriba</Text>
  <Text>Abajo</Text>
</View>
```

Para poner cosas en fila:

```javascriptreact
<View style={{ flexDirection: 'row' }}>
  <Text>Izquierda</Text>
  <Text>Derecha</Text>
</View>
```

---

## 5. Los eventos son distintos

En web tenés `onClick`, `onMouseOver`, etc. En React Native **no existe el mouse**, estás en un teléfono, así que los eventos son táctiles.

| Web | React Native
|-----|-----
| `onClick` | `onPress`
| `onChange` (input) | `onChangeText`
| `onSubmit` | `onPress` en el botón


```html
<!-- Web -->
<button onclick="handlePress()">Click me</button>
```

```javascriptreact
// React Native
import { TouchableOpacity, Text } from 'react-native';

<TouchableOpacity onPress={handlePress}>
  <Text>Click me</Text>
</TouchableOpacity>
```

---

## 6. Los inputs de texto

En web usás `<input type="text">`. En React Native es `<TextInput>` y el valor lo manejás con `useState`.

```html
<!-- Web -->
<input type="text" placeholder="Tu nombre" />
```

```javascriptreact
// React Native
import { useState } from 'react';
import { TextInput, View, Text } from 'react-native';

export default function MyForm() {
  const [name, setName] = useState('');

  return (
    <View>
      <TextInput
        placeholder="Tu nombre"
        value={name}
        onChangeText={(text) => setName(text)}
        style={{ borderWidth: 1, padding: 8 }}
      />
      <Text>Hola, {name}</Text>
    </View>
  );
}
```

---

## 7. Listas de elementos

En web usás `<ul>` y `<li>` o un `.map()`. En React Native usás `<FlatList>` para listas largas (es más eficiente en mobile) o un `.map()` para listas cortas.

**Lista corta (como un `.map()` en web):**

```javascriptreact
const fruits = ['Apple', 'Banana', 'Orange'];

<View>
  {fruits.map((fruit) => (
    <Text key={fruit}>{fruit}</Text>
  ))}
</View>
```

**Lista larga con FlatList (recomendado para muchos items):**

```javascriptreact
import { FlatList, Text } from 'react-native';

const data = [
  { id: '1', name: 'Apple' },
  { id: '2', name: 'Banana' },
];

<FlatList
  data={data}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <Text>{item.name}</Text>}
/>
```

---

## 8. Las imágenes

En web: `<img src="foto.jpg" alt="foto" />`. En React Native: `<Image source={...} />` y **siempre necesita width y height** porque no tiene layout automático.

```javascriptreact
import { Image } from 'react-native';

// Imagen local (dentro del proyecto)
<Image
  source={require('./assets/photo.jpg')}
  style={{ width: 200, height: 200 }}
/>

// Imagen de internet
<Image
  source={{ uri: 'https://example.com/photo.jpg' }}
  style={{ width: 200, height: 200 }}
/>
```

---

## 9. El scroll

En web el scroll es automático si el contenido supera la pantalla. En React Native **no hay scroll por defecto**. Tenés que envolver el contenido en `<ScrollView>`.

```javascriptreact
import { ScrollView, Text } from 'react-native';

<ScrollView>
  <Text>Línea 1</Text>
  <Text>Línea 2</Text>
  {/* ... mucho contenido ... */}
</ScrollView>
```

---

## 10. La estructura de un componente en Expo

Así se ve un componente completo y bien organizado siguiendo buenas prácticas:

```javascriptreact
// components/UserCard.jsx

import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';

export default function UserCard({ name, avatar, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Image source={{ uri: avatar }} style={styles.avatar} />
      <Text style={styles.name}>{name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  name: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
});
```

---

## 11. Resumen mental rapido

Cuando estés programando y no sepas qué usar, preguntate:

- **Quiero contener/agrupar elementos?** → `<View>`
- **Quiero mostrar texto?** → `<Text>`
- **Quiero que el usuario toque algo?** → `<TouchableOpacity>` o `<Pressable>`
- **Quiero que el usuario escriba?** → `<TextInput>`
- **Quiero mostrar una imagen?** → `<Image>`
- **Tengo mucho contenido y quiero scroll?** → `<ScrollView>`
- **Tengo una lista de muchos items?** → `<FlatList>`
- **Quiero aplicar estilos?** → `StyleSheet.create({})` al final del archivo


## Cómo decidir dónde va cada cosa en pantalla

Todo el layout en React Native se basa en **Flexbox**. No hay posiciones absolutas por defecto, no hay `float`, no hay `grid`. Solo flex.

Pensalo así: cada `<View>` es una caja, y vos decidís cómo se organizan las cosas **dentro** de esa caja.

---

### Las propiedades clave que vas a usar el 90% del tiempo

**`flexDirection`** — en qué dirección van los hijos

```javascriptreact
// column es el DEFAULT (vertical, de arriba a abajo)
<View style={{ flexDirection: 'column' }}>
  <Text>Primero</Text>
  <Text>Segundo</Text>   {/* queda debajo */}
</View>

// row = horizontal, de izquierda a derecha
<View style={{ flexDirection: 'row' }}>
  <Text>Izquierda</Text>
  <Text>Derecha</Text>   {/* queda al lado */}
</View>
```

---

**`justifyContent`** — cómo se distribuyen los hijos en la dirección principal

```javascriptreact
// Si flexDirection es 'column', justifyContent mueve las cosas arriba/abajo
// Si flexDirection es 'row', mueve las cosas izquierda/derecha

<View style={{ flex: 1, justifyContent: 'center' }}>
  {/* los hijos quedan en el CENTRO vertical */}
</View>

<View style={{ flex: 1, justifyContent: 'space-between' }}>
  {/* primer hijo arriba del todo, último abajo del todo */}
</View>

<View style={{ flex: 1, justifyContent: 'flex-end' }}>
  {/* los hijos van al FINAL */}
</View>
```

---

**`alignItems`** — cómo se alinean los hijos en la dirección perpendicular

```javascriptreact
// Si flexDirection es 'column', alignItems mueve las cosas izquierda/derecha
<View style={{ flex: 1, alignItems: 'center' }}>
  {/* los hijos quedan centrados HORIZONTALMENTE */}
</View>

<View style={{ flex: 1, alignItems: 'flex-end' }}>
  {/* los hijos van a la DERECHA */}
</View>
```

---

**`flex: 1`** — "ocupá todo el espacio disponible"

```javascriptreact
<View style={{ flex: 1, backgroundColor: 'red' }}>
  {/* ocupa toda la pantalla */}
</View>

// Si dos hijos tienen flex: 1, se dividen el espacio en partes iguales
<View style={{ flex: 1, flexDirection: 'row' }}>
  <View style={{ flex: 1, backgroundColor: 'red' }} />   {/* mitad izquierda */}
  <View style={{ flex: 1, backgroundColor: 'blue' }} />  {/* mitad derecha */}
</View>

// flex: 2 ocupa el doble que flex: 1
<View style={{ flex: 1, flexDirection: 'row' }}>
  <View style={{ flex: 1, backgroundColor: 'red' }} />   {/* 1/3 */}
  <View style={{ flex: 2, backgroundColor: 'blue' }} />  {/* 2/3 */}
</View>
```

---

**`margin` y `padding`** — igual que en web pero en camelCase y sin `px`

```javascriptreact
<View style={{
  marginTop: 16,       // espacio afuera, arriba
  marginHorizontal: 8, // espacio afuera, izquierda y derecha a la vez
  paddingVertical: 12, // espacio adentro, arriba y abajo a la vez
  padding: 16,         // espacio adentro en los 4 lados
}}>
```

---

### Un ejemplo completo: pantalla típica de app

```javascriptreact
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    // flex: 1 = ocupa toda la pantalla
    <View style={styles.screen}>

      {/* HEADER — pegado arriba */}
      <View style={styles.header}>
        <Text style={styles.title}>My App</Text>
      </View>

      {/* CONTENIDO — ocupa el espacio del medio */}
      <View style={styles.content}>
        <Text>Main content here</Text>
      </View>

      {/* BOTÓN — pegado abajo */}
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    padding: 24,
    alignItems: 'center',   // texto centrado horizontalmente
  },
  title: {
    fontSize: 22,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,                // ocupa TODO el espacio entre header y botón
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    margin: 24,
    padding: 16,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
```

El truco del `flex: 1` en `content` es lo más usado: el header y el botón toman su tamaño natural, y el contenido del medio se estira para llenar lo que queda.

---

## Cómo visualizarlo mientras programás

Tenés tres opciones y te conviene usar las tres según el momento:

---

**Opción 1 — Expo Go (tu celular real, la más usada)**

1. Instalás la app **Expo Go** en tu teléfono desde la App Store o Play Store
2. En tu proyecto corres `npx expo start`
3. Escaneás el QR code que aparece en la terminal
4. La app se abre en tu celular y **se actualiza sola cada vez que guardás un archivo**


Es la mejor opción para ver cómo se siente en un teléfono real.

---

**Opción 2 — Emulador (sin celular físico)**

- En Mac: usás el **iOS Simulator** que viene con Xcode. Apretás `i` en la terminal después de `npx expo start`
- En cualquier sistema: usás **Android Studio** con un emulador configurado. Apretás `a` en la terminal


El emulador es un teléfono virtual en tu computadora. Más lento de configurar la primera vez pero útil.

---

**Opción 3 — Expo Snack (sin instalar nada, para probar ideas rápido)**

Entrás a **snack.expo.dev** desde el navegador y escribís código ahí. Te muestra una preview al instante en la misma página. Sirve para probar algo puntual sin necesidad de tener el proyecto abierto.

---

### Truco para entender el layout mientras debuggeás

Cuando no entendés por qué algo no está donde esperás, **dale un `backgroundColor` a cada `<View>`** temporalmente. Así ves exactamente cuánto espacio ocupa cada caja:

```javascriptreact
<View style={{ flex: 1, backgroundColor: 'red' }}>        {/* pantalla entera */}
  <View style={{ padding: 16, backgroundColor: 'blue' }}>  {/* header */}
    <Text>Header</Text>
  </View>
  <View style={{ flex: 1, backgroundColor: 'green' }}>    {/* contenido */}
    <Text>Content</Text>
  </View>
</View>
```

Ves los colores, entendés la estructura, después sacás los `backgroundColor` de debug. Es el equivalente a poner `border: 1px solid red` en web para ver los divs.