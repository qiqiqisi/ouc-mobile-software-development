const fs = require('fs')
const path = require('path')
const icons = {
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  star: '<path d="m12 2 3.1 6.3 7 .9-5.1 5 1.2 7L12 18l-6.2 3.2 1.2-7-5.1-5 7-.9L12 2Z"/>',
  comment: '<path d="M21 11.4a9 9 0 0 1-9 9c-1.5 0-3-.4-4.2-1L3 21l1.4-4.9A9 9 0 1 1 21 11.4Z"/><path d="M8 11h.01M12 11h.01M16 11h.01" stroke-width="3"/>',
  share: '<path d="m14 3 7 6-7 6V11C7 11 4 15 3 20c0-9 3-13 11-13V3Z"/>',
  back: '<path d="m15 4-8 8 8 8"/>',
  history: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6Z"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3.5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  location: '<path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0Z"/><circle cx="12" cy="9" r="2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  home: '<path d="m3 10 9-8 9 8v11h-6v-7H9v7H3V10Z"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 16 5-4 4 3 4-5 5 6"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M16 5a3.5 3.5 0 0 1 0 7M18 15a6 6 0 0 1 4 6"/>'
}
const dir = path.join(__dirname, '../assets/icons')
fs.mkdirSync(dir, { recursive: true })
for (const [name, body] of Object.entries(icons)) {
  for (const active of [false, true]) {
    const fill = active && ['heart', 'star', 'home'].includes(name) ? '#1980c8' : 'none'
    const stroke = active ? '#1980c8' : '#30343b'
    fs.writeFileSync(path.join(dir, `${name}${active ? '-active' : ''}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`)
  }
}
