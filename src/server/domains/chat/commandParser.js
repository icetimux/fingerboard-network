export function parseCommand(text) {
  if (!text.startsWith('/')) return null;
  const [command, ...args] = text.split(' ');
  return { command: command.toLowerCase(), args };
}