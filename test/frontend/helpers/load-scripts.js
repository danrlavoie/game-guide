import { readFileSync } from 'fs';
import vm from 'vm';

export function loadScript(relativePath) {
  var code = readFileSync('public/' + relativePath, 'utf8');
  vm.runInThisContext(code, { filename: relativePath });
}
