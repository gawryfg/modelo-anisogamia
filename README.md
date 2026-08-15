# Anisogamia lab

Simulação interativa da evolução do tamanho dos gametas. O modelo contrapõe a vantagem de produzir muitos gametas pequenos à maior sobrevivência de zigotos grandes.

## Rodar localmente

Requer Node.js 20 ou mais recente.

```bash
npm install
npm run dev
```

## Publicar no GitHub Pages

1. Envie estes arquivos para um repositório GitHub com a branch principal chamada `main`.
2. No repositório, abra **Settings → Pages**.
3. Em **Build and deployment**, escolha **GitHub Actions**.
4. Faça um novo envio para a branch `main` ou execute manualmente a ação **Publicar no GitHub Pages**.

O fluxo em `.github/workflows/deploy-pages.yml` compila e publica o site automaticamente.

## Parâmetros interativos

- `x₀`: ponto médio da curva de sobrevivência do zigoto;
- `L`: probabilidade máxima de sobrevivência;
- `k`: inclinação da curva sigmoide.

O modelo usa 1.000 indivíduos, 100 unidades de energia por indivíduo e mutação normal com desvio-padrão 0,5.
