// Agrega a las pruebas comparaciones como toBeInTheDocument().
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Desmonta lo que dibujó cada prueba para que no se mezcle con la siguiente.
afterEach(() => {
  cleanup()
})
