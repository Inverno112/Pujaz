// Círculo con la inicial de quien puja. El color sale del nombre, así cada persona
// conserva el mismo color en toda la página.
const TONOS = ['#e9dcc7', '#d5dde8', '#ecd3d0', '#d8e4d6', '#e2d6e8', '#f0e1c2']

export function Avatar({ nombre }: { nombre: string }) {
  let suma = 0
  for (const letra of nombre) suma += letra.charCodeAt(0)
  return (
    <span className="avatar" style={{ background: TONOS[suma % TONOS.length] }} aria-hidden="true">
      {nombre.charAt(0).toUpperCase()}
    </span>
  )
}
