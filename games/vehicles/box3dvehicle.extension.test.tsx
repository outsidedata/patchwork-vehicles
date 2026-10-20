// box3dvehicle's extension on games/vehicles, booted under the recorder with its files edited in memory
// and the Vehicle panel on the page. What the panel did is read off the live rows, the recorder's
// journal and the files.
// Each command is driven beside the panel's control it shares a function with, and held to the same
// journal entries or the same bytes, one undo, and the panel's refusals.
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, expect, onTestFinished, test, vi } from 'vitest'
import { EditorContext } from '#editor/context.ts'
import type { FieldProps } from '#editor/editor.ts'
import { TextField } from '#editor/ui/fields.tsx'
import { editor, repo } from '#editor/test/editor.ts'
import { scene as roadScene } from '#games/vehicles/road.sim.ts'
import vehiclesScene from '#games/vehicles/vehicles.scene.json'
import { refill } from '#plugins/loader/loader.sim.ts'
import { box3dvehicle, WEIGHTLESS } from '#plugins/box3dvehicle/box3dvehicle.extension.tsx'

// The file that holds the road's `world.box3dvehicle`: the manager's, whose world the road inherits.
const SCENE = 'games/vehicles/vehicles.scene.json'
// A write refills its file in memory, which the next test boots from: each test ends with the road's
// and the manager's as the disk has them.
afterEach(() => {
  refill(roadScene as Record<string, unknown>, JSON.parse(readFileSync(path.join(repo, 'games/vehicles/road.scene.json'), 'utf8')))
  refill(vehiclesScene as Record<string, unknown>, JSON.parse(readFileSync(path.join(repo, SCENE), 'utf8')))
})
vi.setConfig({ testTimeout: 60_000 })

async function open() {
  const made = await editor('vehicles', { box3dvehicle: async () => ({ box3dvehicle }) })
  const { ed } = made
  onTestFinished(() => ed.close())
  await ed.open()
  for (let i = 0; i < 10; i++) await ed.session!.step()
  act(() => ed.select({ scene: 'road' }))
  const Panel = ed.panels.get('box3dvehicle')!.component
  render(<EditorContext.Provider value={ed}><Panel /></EditorContext.Provider>)
  await screen.findByRole('toolbar', { name: 'vehicle' })
  const road = () => ed.session!.scene('road')
  return { ...made, road }
}

// The grid's sections named, each opened in turn where it is shut: the jeep, then its engine, say.
async function expand(...names: string[]) {
  const user = userEvent.setup()
  for (const name of names) {
    const shut = screen.getAllByRole('button', { name }).find(b => b.getAttribute('aria-expanded') === 'false')
    if (shut) await user.click(shut)
  }
}
// The jeep's final drive, the value the tests write.
const FINAL = 'vehicles.jeep.engine.final'
const jeepOf = (scene: { world: { box3dvehicle: { vehicles: { jeep: any } } } }) => scene.world.box3dvehicle.vehicles.jeep

test('it boots vehicles under the recorder, and the panel shows the road\'s cars', async () => {
  const { ed, road } = await open()
  expect(ed.session!.game.name).toBe('vehicles')
  expect(road().rows.filter(r => r.kind === 'box3dvehicle').length).toBeGreaterThan(0)
  expect(screen.getByRole('slider', { name: 'car throttle' })).toBeTruthy()
})

test('editing one value of world.box3dvehicle changes exactly that value in the scene file', async () => {
  const { ed, edits, read } = await open()
  const before = JSON.parse(await read(SCENE))
  const user = userEvent.setup()
  await expand('jeep', 'engine')
  await user.click(screen.getByRole('spinbutton', { name: FINAL }))
  await user.clear(screen.getByRole('textbox', { name: FINAL }))
  await user.type(screen.getByRole('textbox', { name: FINAL }), '4.3{Enter}')
  await vi.waitFor(() => expect(ed.undos).toHaveLength(1))
  await act(() => ed.idle())
  expect(edits.at(-1)).toMatchObject({ path: SCENE, at: ['world', 'box3dvehicle', 'vehicles', 'jeep', 'engine', 'final'], value: 4.3 })
  expect(edits).toHaveLength(1)
  const after = JSON.parse(await read(SCENE))
  expect(jeepOf(after).engine.final).toBe(4.3)
  jeepOf(after).engine.final = jeepOf(before).engine.final
  expect(after).toEqual(before)
})

test('the suspension shows a meter a wheel, each at the compression and load the car\'s row reports', async () => {
  const { road } = await open()
  const car = road().rows.find(r => r.kind === 'box3dvehicle')!
  const meters = screen.getAllByRole('meter')
  expect(meters.map(m => m.getAttribute('aria-label'))).toEqual(['axle 0 left', 'axle 0 right', 'axle 1 left', 'axle 1 right'].map(n => `${n} compression`))
  meters.forEach((m, i) => {
    expect(Number(m.getAttribute('aria-valuenow'))).toBe(car.data.compression[i])
    expect(m.getAttribute('aria-valuemax')).toBe('0.3')
  })
  // Two wheels on level ground read alike, so each reading shows once for every wheel that reports it.
  const readings = car.data.compression.map((c: number, i: number) => `${c.toFixed(3)} m · ${Math.round(car.data.load[i])} N`)
  for (const r of readings) expect(screen.getAllByText(r)).toHaveLength(readings.filter((s: string) => s === r).length)
})

test('the ride shows how often each axle bounces, from its stiffness and the weight on it', async () => {
  const { road } = await open()
  const v = jeepOf(road())
  // The front axle carries (1.25 + 0.1) / 2.5 of the 600 kg body, 162 kg a wheel, on 16000 N/m.
  const hz = Math.sqrt(v.axles[0].spring.stiffness / ((600 * 1.35) / 2.5 / 2)) / (2 * Math.PI)
  expect(screen.getByLabelText('axle 0 ride').textContent).toMatch(new RegExp(`^${hz.toFixed(2)} Hz`))
})

test('the ride is worked out in the gravity box3d hands the cars, and says so in its place in a scene that names none', async () => {
  const { ed, road } = await open()
  const v = road().world.box3dvehicle
  // Each wheel's share of the road's 9.8 m/s² on the jeep's 600 kg body: the front's (1.25 + 0.1) / 2.5 of it.
  const named = await call(ed, 'vehicle.state', { scene: 'road' })
  expect((named.ride as Record<string, { load: number }[]>).jeep[0].load).toBeCloseTo((600 * 9.8 * 1.35) / 2.5 / 2, 6)
  act(() => ed.session!.previewWorld('road', ['box3dvehicle', 'mods'], { land: v.mods.land }))
  expect(await screen.findByText(`${WEIGHTLESS}.`)).toBeTruthy()
  expect(screen.queryByLabelText('axle 0 ride')).toBeNull()
  expect((await call(ed, 'vehicle.state', { scene: 'road' })).ride).toBe(WEIGHTLESS)
})

test('writing an axle\'s place along the car moves its wheels there when the step is rebuilt', async () => {
  const { ed, edits, read, road } = await open()
  const user = userEvent.setup()
  const AT = 'vehicles.jeep.axles.0.at'
  await expand('jeep', 'axles', '0')
  await user.click(screen.getByRole('spinbutton', { name: AT }))
  await user.clear(screen.getByRole('textbox', { name: AT }))
  await user.type(screen.getByRole('textbox', { name: AT }), '1.6{Enter}')
  await vi.waitFor(() => expect(ed.undos).toHaveLength(1))
  await act(() => ed.idle())
  expect(edits.at(-1)).toMatchObject({ path: SCENE, at: ['world', 'box3dvehicle', 'vehicles', 'jeep', 'axles', 0, 'at'], value: 1.6 })
  expect(jeepOf(JSON.parse(await read(SCENE))).axles[0].at).toBe(1.6)
  await vi.waitFor(() => {
    const car = road().rows.find(r => r.kind === 'box3dvehicle')!
    const part = (id: number) => road().rows.find(r => r.id === id)!.data.pos
    const front = part(car.data.wheels[0]), back = part(car.data.wheels[2])
    expect(Math.hypot(front[0] - back[0], front[2] - back[2])).toBeCloseTo(1.6 + 1.25, 1)
  })
})

test('setting throttle on a car moves that car through the recorder', async () => {
  const { ed, road } = await open()
  const car = road().rows.find(r => r.kind === 'box3dvehicle')!
  const chassis = () => road().rows.find(r => r.id === car.data.chassis)!.data
  const start = [...chassis().pos]
  const n = ed.session!.n
  const slider = screen.getByRole('slider', { name: 'car throttle' })
  fireEvent.change(slider, { target: { value: '1' } })
  fireEvent.pointerUp(slider)
  expect(ed.session!.rec.journal.at(-1)).toMatchObject({ at: n, set: { scene: 'road', id: car.id, path: ['throttle'], value: 1 } })
  for (let i = 0; i < 120; i++) await ed.session!.step()
  expect(Math.hypot(chassis().pos[0] - start[0], chassis().pos[2] - start[2])).toBeGreaterThan(3)
})

// ---------------------------------------------------------------- the commands

// What a call answered, run as React is told of every change it makes.
async function call(ed: Awaited<ReturnType<typeof open>>['ed'], id: string, args: unknown) {
  let got: unknown
  await act(async () => { got = await ed.call(id, args) })
  return got as Record<string, unknown>
}

test('vehicle.state reads what the panel shows: every car\'s inputs and each axle\'s ride, or one car\'s suspension a wheel at a time', async () => {
  const { ed, road } = await open()
  const car = road().rows.find(r => r.kind === 'box3dvehicle')!
  const all = await call(ed, 'vehicle.state', { scene: 'road' })
  expect(all.cars).toEqual(road().rows.filter(r => r.kind === 'box3dvehicle').map(r => ({ id: r.id, vehicle: 'jeep', throttle: 0, brake: 0, steer: 0 })))
  const rides = all.ride as Record<string, { axle: number; hz: number; bump: number; rebound: number; load: number; clearance: number }[]>
  expect(Object.keys(rides)).toEqual(['jeep', 'cart', 'truck'])
  const ride = rides.jeep
  expect(ride.map(r => r.axle)).toEqual([0, 1])
  expect(screen.getByLabelText('axle 0 ride').textContent).toBe(`${ride[0].hz.toFixed(2)} Hz · bump ${ride[0].bump.toFixed(2)} · rebound ${ride[0].rebound.toFixed(2)} · ${Math.round(ride[0].load)} N a wheel · ${ride[0].clearance.toFixed(2)} m under`)

  const one = await call(ed, 'vehicle.state', { scene: 'road', id: car.id })
  expect(one.ride).toEqual(all.ride)
  const wheels = one.suspension as { wheel: string; compression: number; load: number; grounded: boolean; travel: number; sag: number }[]
  expect(wheels.map(w => w.wheel)).toEqual(['axle 0 left', 'axle 0 right', 'axle 1 left', 'axle 1 right'])
  // Each wheel as its meter shows it.
  for (const w of wheels) {
    const meter = screen.getByRole('meter', { name: `${w.wheel} compression` })
    expect(Number(meter.getAttribute('aria-valuenow'))).toBe(w.compression)
    expect(Number(meter.getAttribute('aria-valuemax'))).toBe(w.travel)
  }
  expect(wheels.map(w => w.load)).toEqual(car.data.load)
  expect(wheels.map(w => w.grounded)).toEqual(car.data.grounded.map(Boolean))

  await expect(ed.call('vehicle.state', { scene: 'road', id: 999 })).rejects.toThrow(`row 999 of road is no car: its cars are ${car.id}`)
  await expect(ed.call('vehicle.state', { scene: 'nowhere' })).rejects.toThrow('no scene nowhere of vehicles has box3dvehicle rows: road do')
})

test('vehicle.drive sets a car\'s inputs as the slider does, through the recorder from the step shown, one undo', async () => {
  const { ed, road } = await open()
  const car = road().rows.find(r => r.kind === 'box3dvehicle')!
  const n = ed.session!.n
  const slider = screen.getByRole('slider', { name: 'car throttle' })
  fireEvent.change(slider, { target: { value: '0.5' } })
  fireEvent.pointerUp(slider)
  const byPanel = ed.session!.rec.journal.at(-1)
  await act(() => ed.undo())
  expect(ed.session!.rec.journal).not.toContainEqual(byPanel)

  const got = await call(ed, 'vehicle.drive', { scene: 'road', id: car.id, throttle: 0.5, steer: -0.25 })
  expect(ed.session!.rec.journal.slice(-2)).toEqual([byPanel, { at: n, set: { scene: 'road', id: car.id, path: ['steer'], value: -0.25 } }])
  expect(got).toMatchObject({ scene: 'road', id: car.id, throttle: 0.5, brake: 0, steer: -0.25 })
  expect(ed.undos).toHaveLength(1)
  await act(() => ed.undo())
  expect(road().rows.find(r => r.id === car.id)!.data).toMatchObject({ throttle: 0, steer: 0 })

  await expect(ed.call('vehicle.drive', { scene: 'road', id: car.id, throttle: 2 })).rejects.toThrow(/throttle/)
  await expect(ed.call('vehicle.drive', { scene: 'road', id: car.id })).rejects.toThrow('hand one of throttle, brake, steer to set')
  await expect(ed.call('vehicle.drive', { scene: 'road', id: car.data.chassis, brake: 1 })).rejects.toThrow(/is no car: its cars are /)
})

test('vehicle.design writes a value of world.box3dvehicle as the grid does, the same bytes, one undo; a field the grid has not got or a value not of its shape is refused', async () => {
  const { ed, read } = await open()
  const before = await read(SCENE)
  const user = userEvent.setup()
  await expand('jeep', 'engine')
  await user.click(screen.getByRole('spinbutton', { name: FINAL }))
  await user.clear(screen.getByRole('textbox', { name: FINAL }))
  await user.type(screen.getByRole('textbox', { name: FINAL }), '4.3{Enter}')
  await vi.waitFor(() => expect(ed.undos).toHaveLength(1))
  await act(() => ed.idle())
  expect(jeepOf(JSON.parse(ed.texts.get(SCENE) ?? before)).engine.final).toBe(4.3)
  const byPanel = await read(SCENE)
  await act(() => ed.undo())
  expect(await read(SCENE)).toBe(before)

  const got = await call(ed, 'vehicle.design', { scene: 'road', values: { [FINAL]: 4.3 } })
  expect(await read(SCENE)).toBe(byPanel)
  expect(jeepOf({ world: { box3dvehicle: got.design } } as any).engine.final).toBe(4.3)
  await act(() => ed.undo())
  expect(await read(SCENE)).toBe(before)

  // Two values, one of them in a list, are one undo.
  const two = await call(ed, 'vehicle.design', { scene: 'road', values: { 'vehicles.jeep.axles.0.at': 1.6, 'vehicles.jeep.body.center': [0, -0.1, 0] } })
  expect((two.ride as Record<string, unknown[]>).jeep.length).toBe(2)
  const after = jeepOf(JSON.parse(await read(SCENE)))
  expect([after.axles[0].at, after.body.center]).toEqual([1.6, [0, -0.1, 0]])
  expect(ed.undos).toHaveLength(1)
  await act(() => ed.undo())
  expect(await read(SCENE)).toBe(before)

  await expect(ed.call('vehicle.design', { scene: 'road', values: { 'vehicles.jeep.engine.speed': 1 } })).rejects.toThrow(/world\.box3dvehicle has no field vehicles\.jeep\.engine\.speed: its fields are .*vehicles\.jeep\.engine\.final/)
  await expect(ed.call('vehicle.design', { scene: 'road', values: { 'vehicles.jeep.engine': 1 } })).rejects.toThrow(/world\.box3dvehicle has no field vehicles\.jeep\.engine: its fields under it are .*vehicles\.jeep\.engine\.final/)
  await expect(ed.call('vehicle.design', { scene: 'road', values: { [FINAL]: 'fast' } })).rejects.toThrow(/world\.box3dvehicle vehicles\.jeep\.engine\.final is [\d.]+, and "fast" is not of its shape: .*expected number/s)
  await expect(ed.call('vehicle.design', { scene: 'road', values: { 'vehicles.jeep.body.center': [0, 1] } })).rejects.toThrow(/body\.center is \[.*\], and \[0,1\] is not of its shape/)
  await expect(ed.call('vehicle.design', { scene: 'road', values: {} })).rejects.toThrow(/hand a value of world\.box3dvehicle to set, by its path: its fields are .*vehicles\.jeep\.engine\.final/)
  expect(await read(SCENE)).toBe(before)
})

// A field bound to a type whose component writes another shape than the file's, as a text field
// writes a number as its text, and shows what it writes on the scene's world before it writes it,
// as a person's drag does.
function Text({ value, onChange, label }: FieldProps) {
  return <TextField label={label} value={String(value)} onChange={(v, done) => {
    onChange(v, false)
    if (done) onChange(v, true)
  }} />
}

test('a value the grid hands that is not of the shape there is refused in the console as the command refuses it, and the scene\'s world, which showed it, is its file\'s again', async () => {
  const { ed, edits, road } = await open()
  const final = () => jeepOf(road()).engine.final
  const was = final()
  act(() => {
    ed.field('test.text', Text)
    ed.bind('box3dvehicle', { [FINAL]: 'test.text' })
  })
  await expand('jeep', 'engine')
  const shown = vi.spyOn(ed.session!, 'previewWorld')
  const user = userEvent.setup()
  await user.clear(screen.getByRole('textbox', { name: FINAL }))
  await user.type(screen.getByRole('textbox', { name: FINAL }), '4.3{Enter}')
  const why = `world.box3dvehicle ${FINAL} is ${was}, and "4.3" is not of its shape`
  await vi.waitFor(() => expect(ed.log.at(-1)).toMatchObject({ level: 'error', message: expect.stringContaining(`box3dvehicle: refused: ${why}`) }))
  // Shown, then put back when refused.
  const at = ['box3dvehicle', 'vehicles', 'jeep', 'engine', 'final']
  expect(shown.mock.calls).toEqual([['road', at, '4.3'], ['road', at, was]])
  expect(final()).toBe(was)
  await expect(ed.call('vehicle.design', { scene: 'road', values: { [FINAL]: '4.3' } })).rejects.toThrow(why)
  expect(edits).toEqual([])
})
