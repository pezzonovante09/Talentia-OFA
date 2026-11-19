/** asm.js-сборка `sql.js` (web-прототип, `services/local/expoSqlite.web.ts`) — те же типы, что у основного модуля. */
declare module 'sql.js/dist/sql-asm.js' {
  import initSqlJs from 'sql.js';

  export * from 'sql.js';
  export default initSqlJs;
}
