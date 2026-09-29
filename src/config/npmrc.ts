export function npmrcContent(): string {
  return `@raulmoracode:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=\${GH_TOKEN}\n`;
}
