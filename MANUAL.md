# qbx_vehiclesales — Manual

Concessionária de usados entre jogadores: anuncie seu veículo em um pátio, veja o contrato dos carros expostos e compre direto de outro jogador.

---

## Sumário

1. [Dependências](#dependências)
2. [Instalação](#instalação)
3. [Banco de dados](#banco-de-dados)
4. [Configuração](#configuração)
5. [Fluxo de uso](#fluxo-de-uso)
6. [Valores e taxas](#valores-e-taxas)
7. [Integrações](#integrações)
8. [Entrypoints para outros recursos](#entrypoints-para-outros-recursos)
9. [Localização](#localização)
10. [Estrutura de arquivos](#estrutura-de-arquivos)

---

## Dependências

| Recurso | Obrigatório | Observação |
|---|---|---|
| `qbx_core` | Sim | Framework base: `GetPlayer`, `GetPlayerByCitizenId`, `GetVehiclesByName`, `Notify`, `qbx.spawnVehicle` |
| `ox_lib` | Sim | Locale, callbacks, zonas, menu de contexto, `getVehicleProperties` / `setVehicleProperties` |
| `oxmysql` | Sim | Tabelas `occasion_vehicles`, `player_vehicles`, `players`, `vehicle_financing` |
| `ox_target` | Não | Alternativa às zonas de interação nos carros expostos (`useTarget`) |
| `qbx_vehiclekeys` | Não | Recebe `vehiclekeys:client:SetOwner` ao entregar o veículo comprado |
| `qb-phone` | Não | Envia e-mail ao vendedor offline quando o veículo é vendido (`qb-phone:server:sendNewMailToOffline`) |
| `qb-logs` | Não | Recebe logs de anúncio e de compra (`qb-log:server:CreateLog`, canal `vehicleshop`) |

---

## Instalação

1. Copie a pasta `qbx_vehiclesales` para `resources/`.
2. Importe o `qb-vehiclesales.sql` no banco.
3. Adicione ao `server.cfg`, depois das dependências:
   ```
   ensure qbx_vehiclesales
   ```
4. **Conflitos** — não rode junto com `qb-vehiclesales` / `ps-vehiclesales`; os eventos `qb-occasions:*` e `qb-vehiclesales:*` são os mesmos.

---

## Banco de dados

O recurso cria e usa a tabela `occasion_vehicles`, que guarda os anúncios ativos:

```sql
CREATE TABLE IF NOT EXISTS `occasion_vehicles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `seller` varchar(50) DEFAULT NULL,
  `price` int(11) DEFAULT NULL,
  `description` longtext DEFAULT NULL,
  `plate` varchar(50) DEFAULT NULL,
  `model` varchar(50) DEFAULT NULL,
  `mods` text DEFAULT NULL,
  `occasionid` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `occasionId` (`occasionid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

| Coluna | Descrição |
|---|---|
| `seller` | `citizenid` de quem anunciou |
| `price` | Preço pedido |
| `description` | Texto livre exibido no contrato |
| `plate` | Placa do veículo |
| `model` | Spawn name do modelo |
| `mods` | JSON com as propriedades do veículo (`lib.getVehicleProperties`), preservadas na venda |
| `occasionid` | Identificador do anúncio (`OC` + número aleatório) |

Enquanto o veículo está anunciado, a linha correspondente é **removida** de `player_vehicles`. Ela é recriada quando o carro é comprado ou retirado do pátio pelo próprio dono.

O recurso também lê `vehicle_financing` para bloquear a venda de veículos com financiamento em aberto.

---

## Configuração

Arquivo: `config/client.lua`.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `useTarget` | bool | Sim | `true` usa `ox_target` nos carros expostos; `false` usa zonas com Text UI (tecla `E`) |
| `zones` | tabela de zonas | Sim | Uma entrada por pátio. A chave é o id interno da zona |

Cada zona aceita:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `businessName` | string | Sim | Nome exibido no topo do contrato e do menu |
| `sellVehicle` | vec4 | Sim | Ponto de atendimento: chegue de carro e pressione `E` para abrir o menu de venda |
| `buyVehicle` | vec4 | Sim | Onde o veículo comprado (ou retirado) é entregue |
| `polyzone` | array de vec3 | Sim | Perímetro do pátio. Os carros anunciados só são spawnados quando o jogador entra nele |
| `vehicleSpots` | array de vec4 | Sim | Vagas de exposição. **O número de vagas é o limite de anúncios simultâneos** — com todas ocupadas, novos anúncios são recusados |

A zona padrão (`sandyOccasions`) fica em Sandy Shores, com 25 vagas.

---

## Fluxo de uso

**Anunciar** — dirija o próprio veículo até `sellVehicle`, pressione `E` e escolha "vender veículo". O servidor confirma que o carro está no seu nome e sem financiamento em aberto. Preencha preço e descrição no contrato NUI; o veículo some do seu garage e passa a ocupar uma vaga do pátio.

**Comprar** — entre no pátio, interaja com um carro exposto (target ou `E`) para abrir o contrato com os dados do vendedor, a descrição e o preço. Confirmando, o valor sai do seu banco e o veículo é entregue em `buyVehicle`, com as modificações preservadas.

**Retirar o próprio anúncio** — se você abrir o contrato de um carro que **você mesmo** anunciou, o botão de retirada aparece: o anúncio é apagado e o veículo volta para o seu garage, entregue em `buyVehicle`.

**Vender de volta à concessionária** — no ponto de atendimento, a opção "vender de volta" paga 50% do valor de tabela do modelo e deleta o veículo. Também exige que o carro esteja no seu nome e sem financiamento.

Os carros expostos ficam congelados, invencíveis e trancados. Qualquer anúncio, compra ou retirada dispara um refresh do pátio para todos os jogadores.

---

## Valores e taxas

| Operação | Valor |
|---|---|
| Compra entre jogadores | O comprador paga o preço cheio do anúncio (débito no banco) |
| Repasse ao vendedor | **77%** do preço do anúncio (creditado no banco, mesmo se estiver offline) |
| Venda de volta à concessionária | **50%** do preço base do modelo (`GetVehiclesByName`), creditado no banco |

A diferença de 23% na venda entre jogadores é retida pela casa. Esses percentuais estão no código (`server/main.lua`), não no config.

---

## Integrações

### ox_target

Com `useTarget = true`, cada carro exposto ganha a opção "ver contrato". Com `false`, o recurso cria uma `lib.zones.box` por vaga e usa Text UI com a tecla `E`. O ponto de atendimento (`sellVehicle`) sempre usa zona + `E`, independente da flag.

### qb-phone

Quando um veículo é vendido e o vendedor está offline, o recurso dispara `qb-phone:server:sendNewMailToOffline` com o valor repassado e o nome do modelo. Se o servidor não usa `qb-phone`, o evento simplesmente não é capturado.

### qb-logs

Anúncios e compras disparam `qb-log:server:CreateLog` no canal `vehicleshop`.

### Financiamento (`vehicle_financing`)

Antes de anunciar ou vender de volta, o servidor consulta o saldo devedor do veículo em `vehicle_financing`. Com saldo > 0, a operação é recusada.

---

## Entrypoints para outros recursos

Não há exports. Eventos de servidor:

```lua
-- Anuncia um veículo no pátio
TriggerServerEvent('qb-occasions:server:sellVehicle', price, vehicleData)

-- Compra um veículo anunciado
TriggerServerEvent('qb-occasions:server:buyVehicle', vehicleData)

-- Retira o próprio anúncio e devolve o veículo ao garage
TriggerServerEvent('qb-occasions:server:ReturnVehicle', vehicleData)

-- Vende o veículo de volta à concessionária por 50% do valor base
TriggerServerEvent('qb-occasions:server:sellVehicleBack', vehData)
```

Eventos de cliente:

```lua
TriggerEvent('qb-occasions:client:MainMenu')          -- menu do ponto de atendimento
TriggerEvent('qb-vehiclesales:client:SellVehicle')    -- abre o contrato de venda
TriggerEvent('qb-occasions:client:SellBackCar')       -- vende de volta à concessionária
TriggerEvent('qb-vehiclesales:client:OpenContract', i) -- abre o contrato da vaga i
TriggerEvent('qb-occasion:client:refreshVehicles')    -- respawna os carros do pátio
```

Callbacks registrados no servidor:

- `qb-occasions:server:getVehicles` — lista todos os anúncios.
- `qb-occasions:server:getSellerInformation` — dados do vendedor pelo `citizenid`.
- `qb-vehiclesales:server:CheckModelName` — modelo de um veículo pela placa.
- `qbx_vehiclesales:server:spawnVehicle` — spawna o veículo comprado com as mods.
- `qbx_vehiclesales:server:checkVehicleOwner` — retorna `owned, balance` (saldo de financiamento).

---

## Localização

Strings via locale do `ox_lib`. Idiomas em `locales/`: `ar`, `cs`, `de`, `en`, `es`, `et`, `fr`, `is`, `it`, `nl`, `pt`, `pt-br`, `ro`, `sv`, `tr`.

```
setr ox:locale "pt-br"
```

---

## Estrutura de arquivos

```
qbx_vehiclesales/
├── client/
│   └── main.lua          — zonas do pátio, spawn dos carros expostos, contratos NUI, menu
├── server/
│   └── main.lua          — CRUD de occasion_vehicles, compra/venda, repasse ao vendedor, logs
├── config/
│   └── client.lua        — useTarget e zonas (perímetro, vagas, pontos de venda e entrega)
├── html/
│   ├── ui.html           — contrato de compra/venda (NUI)
│   ├── ui.js             — lógica do contrato (Vue)
│   ├── ui.css            — estilos
│   ├── vue.min.js        — Vue 2 embarcado
│   ├── logo.svg          — logo do contrato
│   └── papel.jpg         — textura de fundo do contrato
├── locales/              — traduções (15 idiomas)
├── qb-vehiclesales.sql   — tabela occasion_vehicles
└── fxmanifest.lua
```
