# Hover Canvas Magic

screva a implementação em Vanilla JavaScript, HTML5 Canvas e CSS para aplicar o efeito Hover-driven animation (animação controlada pelo movimento do mouse) usando a sequência completa de imagens que acabei de enviar (ezgif-frame-025.png até ezgif-frame-232.png).

Especificações Técnicas do Hover-Driven:

Mapeamento do Eixo X:

O contêiner da animação (#animation-container) deve escutar o evento mousemove.

A posição horizontal do cursor (clientX em relação à largura do contêiner) deve ser convertida em uma porcentagem normalizada de 0 a 1 (onde 0 é a extrema esquerda e 1 é a extrema direita).

Mapeamento de Frames:

Mapear essa porcentagem linearmente para o intervalo exato de índices que vai do frame 25 (ezgif-frame-025.png) até o frame 232 (ezgif-frame-232.png).

O resultado deve ser arredondado para um número inteiro para definir o frame ativo.

Fluidez e Performance:

Utilizar requestAnimationFrame para atualizar o desenho no Canvas (ctx.drawImage) apenas quando houver mudança real de frame, evitando re-renderizações desnecessárias.

Implementar uma função de preload que armazene todas as imagens em cache num array antes de iniciar a interação, garantindo que não haja travamentos (lag) ao mover o mouse rapidamente.

Tratamento de Nomes (Padding):

Gerar dinamicamente os nomes dos arquivos garantindo que mantenham o formato com 3 dígitos e o prefixo correto (ezgif-frame-XXX.png), utilizando formatação baseada em string (ex: String(i).padStart(3, '0')).

Por favor, forneça o código modularizado (HTML estrutural, CSS para centralizar/responsividade e o script JavaScript completo) pronto para uso.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fa47447a-9205-43df-9019-7f9e5bfe6336).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
