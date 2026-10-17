# Impala · No seu pulso

Simulador de relógio no pulso, em tamanho real, para a página de produto da Relojoaria Impala (Loja Integrada).

Instalação (Visual › Incluir código HTML › rodapé › Página de produto › HTML):

```html
<script src="https://cdn.jsdelivr.net/gh/oliveiratigor/impala-pulso@main/impala-pulso.min.js" data-estilo="minimal" data-teste charset="utf-8" defer></script>
```

- `data-estilo`: `minimal` ou `completo`
- `data-teste`: só aparece com `?pulso=1` no endereço; apague para liberar a todos
- `?pulso=debug`: mostra o recorte e as medidas lidas

Opções extras na mesma linha:
- `data-guia="URL"`: mostra o link para o guia de medição do pulso
- `data-escuro`: liga o botão "Ver no escuro" (lume)
- `data-foto`: liga "Ver na foto do meu pulso"
