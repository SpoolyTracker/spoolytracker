# Security Policy

Please report vulnerabilities privately before public disclosure.

For self-hosted deployments:

- set strong values for all secrets in `.env.selfhost`;
- do not expose Postgres or Redis publicly;
- rotate any credential that was committed before the public release;
- keep Docker images updated.

Security reports should include reproduction steps, affected version or commit, and impact.
