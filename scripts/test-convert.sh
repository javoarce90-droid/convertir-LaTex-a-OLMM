#!/bin/bash
# test-convert.sh
# Prueba el endpoint /convert con contenido real del documento "Teorema de Stokes".
# Cubre los comandos LaTeX que antes fallaban: \mathbf, \nabla, \iint, \oint,
# \left\langle...\right\rangle, \frac{\partial}, \cos\theta, \sin\theta, etc.
#
# Uso:
#   chmod +x test-convert.sh
#   ./test-convert.sh
#
# Variables de entorno opcionales:
#   BASE_URL  → por defecto http://localhost:3000
#   API_KEY   → por defecto "mi_clave_secreta"

BASE_URL="${BASE_URL:-http://localhost:8080}"
API_KEY="${API_KEY:-}"
OUTPUT_FILE="stokes_test_output.docx"

curl -s -X POST "${BASE_URL}/convert" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -o "${OUTPUT_FILE}" \
  -w "\n→ HTTP %{http_code} | %{size_download} bytes descargados\n" \
  -d '{
    "templateVars": {

      "tituloSesion": "Teorema de Stokes",
      "docente": "Arturo Barrera",
      "institucionEducativa": "Institución Educativa Ejemplo",
      "nivel": "Secundaria",
      "grado": "Quinto",
      "area": "Matemática",
      "seccion": "A",
      "fecha": "10/04/2026",

      "competencias": "Resuelve problemas de regularidad, equivalencia y cambio.",
      "desempeños": "Establece relaciones entre datos, valores desconocidos, regularidades y condiciones de equivalencia o variación entre magnitudes. Transforma esas relaciones a expresiones algebraicas o gráficas.",
      "proposito": "Analizar y resolver situaciones que implican el Teorema de Stokes, estableciendo relaciones entre datos y condiciones de equivalencia o variación.",
      "evidencia": "Los estudiantes redactarán y presentarán una solución paso a paso que aplica el Teorema de Stokes para calcular la circulación de un campo vectorial sobre una superficie dada.",

      "inicio": "**Parte teórica: Teorema de Stokes**\n\nEl **Teorema de Stokes** relaciona la integral de línea de un campo vectorial a lo largo de una curva cerrada con la integral de superficie de su rotacional. Formalmente, para un campo vectorial $\\mathbf{F} = (P,Q,R)$ con curva cerrada simple $C$ y superficie $S$ con frontera $C$:\n\n$$\\oint_{C} \\mathbf{F} \\cdot d\\mathbf{r} = \\iint_{S} (\\nabla \\times \\mathbf{F}) \\cdot d\\mathbf{S}$$\n\nEl teorema generaliza el **Teorema de Green** al espacio tridimensional. En el plano $xy$, si $S$ es una región plana con normal $\\mathbf{n} = (0,0,1)$, entonces:\n\n$$\\nabla \\times \\mathbf{F} \\cdot \\mathbf{n} = \\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}$$\n\ny el teorema se reduce a:\n\n$$\\oint_{C} P\\,dx + Q\\,dy = \\iint_{S} \\left(\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}\\right) dA$$\n\nSi $\\mathbf{F}$ es conservativo ($\\nabla \\times \\mathbf{F} = \\mathbf{0}$), ambas integrales son cero.",

      "desarrollo": "**Ejemplo resuelto: campo $\\mathbf{F} = (-y, x, z)$**\n\nDeterminar el rotacional:\n\n$$\\nabla \\times \\mathbf{F} = \\left(0, 0, -2\\right)$$\n\nElegir la superficie $\\Sigma$: parte superior de la esfera de radio 1.\n\nParametrizar con coordenadas esféricas: $\\mathbf{r}(\\phi,\\theta) = (\\sin\\phi\\cos\\theta,\\, \\sin\\phi\\sin\\theta,\\, \\cos\\phi)$.\n\nEvaluar la integral de superficie:\n\n$$\\iint_{\\Sigma} (\\nabla \\times \\mathbf{F}) \\cdot d\\mathbf{S} = \\int_{0}^{2\\pi}\\int_{0}^{\\pi/2} (-2)\\,\\cos\\phi\\,\\sin\\phi\\,d\\phi\\,d\\theta = -2\\pi\\left[\\frac{\\sin^{2}\\phi}{2}\\right]_{0}^{\\pi/2} = -\\pi$$\n\n**Rotacional general**\n\nPara $\\mathbf{F} = (F_x, F_y, F_z)$:\n\n$$\\nabla \\times \\mathbf{F} = \\left\\langle \\frac{\\partial F_z}{\\partial y} - \\frac{\\partial F_y}{\\partial z},\\; \\frac{\\partial F_x}{\\partial z} - \\frac{\\partial F_z}{\\partial x},\\; \\frac{\\partial F_y}{\\partial x} - \\frac{\\partial F_x}{\\partial y} \\right\\rangle$$\n\n**Ejemplo con cilindro**\n\nSea $C$ el borde superior del cilindro $x^2 + y^2 = 4$, $z = 2$, con normal $\\mathbf{n} = \\langle\\cos\\theta,\\,\\sin\\theta,\\,0\\rangle$.\n\n$$(\\nabla \\times \\mathbf{F}) \\cdot \\mathbf{n} = \\langle 1,-1,0 \\rangle \\cdot \\langle\\cos\\theta,\\sin\\theta,0\\rangle = \\cos\\theta - \\sin\\theta$$\n\nIntegrando:\n\n$$\\oint_{C} \\mathbf{F} \\cdot d\\mathbf{r} = \\int_{0}^{2\\pi} 2(\\cos\\theta - \\sin\\theta)\\,d\\theta = 0$$",

      "cierre": "**Metacognición**\n\n- ¿Qué parte del proceso de aplicar el Teorema de Stokes te resultó más fácil?\n- ¿Cómo describirías la relación entre la integral de línea y la integral de superficie?\n- ¿Qué estrategias de simplificación te funcionaron mejor: elegir una superficie con simetría, parametrizar, usar coordenadas adecuadas?\n\n**Reflexión final**\n\nHemos convertido la integral de línea $\\oint_C \\mathbf{F} \\cdot d\\mathbf{r}$ en una integral de superficie $\\iint_S (\\nabla \\times \\mathbf{F}) \\cdot d\\mathbf{S}$, obteniendo el mismo resultado $-\\pi$. La equivalencia demuestra que la circulación depende solo de la orientación y la topología de la curva, no de su forma exacta.",

      "ejerciciosRespuestas": "**Ficha 1 — Aplicación básica del Teorema de Stokes**\n\nSea el campo vectorial $\\mathbf{F}(x,y,z) = \\langle y,\\,x,\\,z\\rangle$ y la superficie $S$ la porción del plano $z = 1$ limitada por el círculo $x^2 + y^2 = 4$.\n\n1. Calcule $\\nabla \\times \\mathbf{F}$.\n2. Evalúe $\\displaystyle\\oint_{C} \\mathbf{F} \\cdot d\\mathbf{r}$ usando el Teorema de Stokes.\n3. Exprese la circulación como función del radio $R$.\n\n**Respuesta:**\n\n$$\\nabla \\times \\mathbf{F} = \\langle 1-0,\\; 0-1,\\; 1-1 \\rangle = \\langle 1,\\,-1,\\,0 \\rangle$$\n\n$(\\nabla \\times \\mathbf{F}) \\cdot \\mathbf{n} = \\langle 1,-1,0 \\rangle \\cdot \\langle 0,0,1 \\rangle = 0$\n\nPor lo tanto $\\displaystyle\\oint_{C} \\mathbf{F} \\cdot d\\mathbf{r} = 0$ para todo radio $R$.\n\n---\n\n**Ficha 2 — Equivalencia entre dos superficies**\n\nCampo $\\mathbf{F}(x,y,z) = \\langle 2x,\\,3y,\\,z^2 \\rangle$, superficie $S$ es la porción del plano $y = 0$ limitada por $x^2 + z^2 = 9$.\n\n**Respuesta:**\n\n$$\\nabla \\times \\mathbf{F} = \\langle \\partial_z(3y) - \\partial_y(z^2),\\; \\partial_x(z^2) - \\partial_z(2x),\\; \\partial_y(2x) - \\partial_x(3y) \\rangle = \\langle 0,\\,0,\\,1 \\rangle$$\n\n$(\\nabla \\times \\mathbf{F}) \\cdot \\mathbf{n} = \\langle 0,0,1 \\rangle \\cdot \\langle 0,1,0 \\rangle = 0$\n\nLa circulación es $0$ para cualquier radio $R$. La sucesión es **constante** (ni creciente ni decreciente)."
    }
  }'

echo "→ Archivo guardado como: ${OUTPUT_FILE}"
