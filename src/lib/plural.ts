/** "1 move", "2 moves", "1,204 games": a count with its noun in the right number. */
export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
