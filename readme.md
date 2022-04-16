# Servn

## References

[local https tutorial](https://web.dev/how-to-use-local-https)

[mkcert](https://github.com/FiloSottile/mkcert)

```bash
mkcert -install
mkcert localhost
```

## Help

```sh
  Servn

  Usage: servn ...args [options]

  Options:
    --host       define the host
    -f, --file   define the entry file
    -e, --entry  define the entry path
    -p, --port   define the port
    -s, --tls    whether to use https or http
    -d, --dir    define the TLS cert directory
    -c, --cert   define the TLS cert
    -k, --key    define the TLS key
    -h, --help   show this dialog

  Examples:
    servn
    servn . -p 3000
    servn ~/project --host example.com --file index.js
```
