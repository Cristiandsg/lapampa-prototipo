# Guía de Git y GitHub del equipo

## Ramas

| Rama | Para qué | Quién escribe |
|---|---|---|
| `main` | Versión aceptada por el PO en cada Sprint Review (v0.1, v0.2…). Es la que se publica en la nube | Solo por Pull Request desde `develop` |
| `develop` | Integración del sprint en curso | Solo por Pull Request desde ramas `feature/` |
| `feature/HUxx-descripcion` | Una por historia o tarea de Jira | Quien tiene la historia |

```
main     ●────────────────────●─────────── (v0.1)
          \                  /
develop    ●──────●─────●───●
                 /     /
feature/HU03    ●──●──●
```

Para el Sprint 0 ya existen `feature/HT-01-despliegue-nube` (Esteban) y `feature/HT-03-mockups` (Cristian).

## El día a día (en VS Code)

Abrir la terminal de VS Code con **Ctrl + ñ** (o Ctrl + `).

**1. Empezar una historia**
```bash
git switch develop
git pull
git switch -c feature/HU03-crear-mesas
```

**2. Guardar avances** (varias veces al día)
```bash
git add .
git commit -m "HU03: valida que no se repita el nombre de una mesa activa"
git push -u origin feature/HU03-crear-mesas   # la primera vez; después basta con: git push
```
También se puede hacer desde el ícono de **Control de código fuente** (Ctrl + Shift + G): escribir el mensaje, ✓ Confirmar y luego Sincronizar.

**3. Terminar la historia**
1. En GitHub aparece el botón **Compare & pull request**. Base: `develop` ← compare: tu rama.
2. Llenar la plantilla (la historia, cómo probarlo y el checklist).
3. Pedir revisión a otro integrante. Cuando la apruebe, **Squash and merge** y borrar la rama.

**4. Mantener tu rama al día** si `develop` cambió mientras trabajabas
```bash
git switch develop
git pull
git switch feature/HU03-crear-mesas
git merge develop
```

**5. Cierre de sprint** (lo hace el Scrum Master después del Review)
1. Pull Request de `develop` → `main`, título "Sprint 1 — v0.1".
2. Después del merge: GitHub → **Releases** → *Draft a new release* → tag `v0.1`.

## Mensajes de commit

Empiezan con el ID de la historia, en presente y cortos:
- `HU07: registra pago mixto en una sola transacción`
- `HT-02: agrega índice por fecha de pago`
- `docs: actualiza diccionario de datos`

## Reglas

- Nunca trabajar directamente en `main` ni en `develop`.
- Nunca subir el archivo `.env` (ya está en `.gitignore`).
- Antes de abrir un PR: `npm test` y `npm run lint` desde la raíz.
- Si hay un conflicto y no sabes resolverlo, avisa en el Daily antes de forzar nada (`git push --force` está prohibido en `main` y `develop`).
