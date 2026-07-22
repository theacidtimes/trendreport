import { OPERADORA } from "@/lib/legal";

// Conteúdo do T&C em prosa (sem travessão, por preferência editorial). Fonte de
// verdade única: reusado pela página /termos e pelo modal (TermosModal). `paras`
// vira parágrafos; `itens` vira lista. Editável por quem for revisar juridicamente
// sem mexer no layout.
type Secao = { titulo: string; paras?: string[]; itens?: string[] };

const SECOES: Secao[] = [
  {
    titulo: "1. Aceitação dos Termos",
    paras: [
      `Estes Termos e Condições de Uso (os "Termos") regem o acesso e o uso da plataforma de inteligência de tendências (a "Plataforma"), desenvolvida e operada por ${OPERADORA.nome}, inscrita no CNPJ sob o nº ${OPERADORA.cnpj} (a "Operadora").`,
      `Ao acessar a Plataforma, ativar sua conta ou realizar o primeiro login, você declara ter lido, compreendido e aceitado integralmente estes Termos. Caso você acesse a Plataforma em nome de uma pessoa jurídica (o "Cliente"), você declara ter poderes para vinculá-la a estes Termos, e as referências a "você" ou "Usuário" alcançam também essa pessoa jurídica.`,
      "Se você não concordar com estes Termos, não deve acessar nem utilizar a Plataforma.",
    ],
  },
  {
    titulo: "2. Definições",
    itens: [
      `"Operadora": ${OPERADORA.nome}, CNPJ ${OPERADORA.cnpj}, titular e responsável pela operação da Plataforma.`,
      '"Cliente": a pessoa jurídica contratante que licencia o uso da Plataforma para seus times.',
      '"Usuário": a pessoa física autorizada pelo Cliente a acessar a Plataforma (por exemplo, planners e estrategistas).',
      '"Plataforma": o software, as interfaces, os algoritmos, os relatórios e os demais recursos disponibilizados pela Operadora.',
      '"Conteúdo do Cliente": os dados, briefings e informações inseridos pelo Cliente ou pelo Usuário na Plataforma.',
      '"Resultados": os relatórios, análises, sínteses e insights gerados pela Plataforma.',
    ],
  },
  {
    titulo: "3. Titularidade e Operação da Plataforma",
    paras: [
      "A Plataforma é de titularidade exclusiva da Operadora, que a desenvolve, mantém e opera. Nenhuma disposição destes Termos transfere ao Cliente ou ao Usuário qualquer direito de propriedade sobre a Plataforma.",
      "Marcas, logotipos, layout, código-fonte, bancos de dados, modelos, algoritmos e a arquitetura da Plataforma pertencem à Operadora ou a seus licenciadores. Eventuais elementos de identidade visual personalizados para o Cliente (white-label) não alteram a titularidade da Plataforma nem a condição da Operadora como sua operadora.",
    ],
  },
  {
    titulo: "4. Licença de Uso",
    paras: [
      "Sujeito ao cumprimento destes Termos e ao pagamento das eventuais contraprestações acordadas, a Operadora concede ao Cliente uma licença limitada, não exclusiva, intransferível, revogável e sem direito de sublicenciamento, para acessar e utilizar a Plataforma durante a vigência da contratação, exclusivamente para suas finalidades internas de negócio.",
      "É vedado, salvo autorização expressa e por escrito da Operadora: (a) copiar, modificar, traduzir ou criar obras derivadas da Plataforma; (b) realizar engenharia reversa, descompilar ou tentar extrair o código-fonte; (c) sublicenciar, alugar, revender ou disponibilizar a Plataforma a terceiros; (d) remover avisos de titularidade ou de operação; e (e) utilizar a Plataforma para desenvolver produto ou serviço concorrente.",
    ],
  },
  {
    titulo: "5. Propriedade Intelectual",
    paras: [
      "Todos os direitos de propriedade intelectual sobre a Plataforma e sobre quaisquer melhorias, correções ou novas funcionalidades permanecem com a Operadora.",
      "O Conteúdo do Cliente permanece de titularidade do Cliente. O Cliente concede à Operadora uma licença não exclusiva para hospedar, processar e utilizar o Conteúdo do Cliente na estrita medida necessária para prestar e aprimorar os serviços da Plataforma.",
      "Os Resultados são disponibilizados ao Cliente para uso em suas atividades. Os componentes de software, modelos e metodologias empregados para gerá-los permanecem de titularidade da Operadora. O Cliente é o único responsável pelo uso que fizer dos Resultados e pelas decisões tomadas com base neles.",
    ],
  },
  {
    titulo: "6. Cessão de Direitos",
    paras: [
      "Na hipótese de o Usuário ou o Cliente submeter à Operadora sugestões, comentários ou ideias de aprimoramento sobre a Plataforma (o \"Feedback\"), o Cliente cede à Operadora, de forma gratuita, irrevogável e sem limitação territorial ou temporal, todos os direitos patrimoniais sobre esse Feedback, podendo a Operadora incorporá-lo à Plataforma sem qualquer obrigação de contrapartida.",
      "O Cliente autoriza a Operadora a anonimizar e agregar os dados e sinais processados na Plataforma, desvinculando-os de qualquer identidade da marca, para fins de composição de um banco de dados estatístico e de tendências globais (Fabric Lake), o qual será de propriedade exclusiva da Operadora.",
      "Eventuais cessões de direitos sobre entregáveis específicos, quando existirem, serão regidas pelo contrato comercial firmado entre a Operadora e o Cliente, que prevalece sobre estes Termos em caso de conflito quanto a esse ponto.",
    ],
  },
  {
    titulo: "7. Proteção de Dados Pessoais (LGPD)",
    paras: [
      "O tratamento de dados pessoais observa a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais, ou LGPD).",
      "Quanto aos dados cadastrais e de acesso do Usuário (nome, e-mail, credenciais, registros de login e de aceite destes Termos), a Operadora atua como controladora, tratando-os com base na execução do contrato e no legítimo interesse, com a finalidade de autenticar acessos, viabilizar o uso da Plataforma, garantir segurança e comprovar o aceite.",
      "Quanto ao Conteúdo do Cliente e a dados pessoais nele contidos, o Cliente atua como controlador e a Operadora como operadora, tratando tais dados apenas conforme as instruções do Cliente e para a prestação dos serviços.",
      "A Plataforma coleta e processa dados majoritariamente públicos disponíveis em fontes abertas para produzir análises agregadas de tendências. A Operadora adota medidas técnicas e administrativas de segurança para proteger os dados contra acessos não autorizados e situações de incidente.",
      "O titular de dados pessoais pode exercer os direitos previstos na LGPD, incluindo confirmação, acesso, correção, anonimização, portabilidade e eliminação, mediante solicitação pelos canais de contato indicados nestes Termos. A Operadora não comercializa dados pessoais.",
    ],
  },
  {
    titulo: "8. Obrigações do Usuário e Uso Aceitável",
    itens: [
      "Manter a confidencialidade de suas credenciais de acesso, respondendo por toda atividade realizada em sua conta.",
      "Utilizar a Plataforma de forma lícita e em conformidade com estes Termos e com a legislação aplicável.",
      "Não inserir na Plataforma conteúdo ilícito, difamatório ou que viole direitos de terceiros.",
      "Não tentar burlar mecanismos de segurança, sobrecarregar a infraestrutura ou acessar áreas às quais não tenha autorização.",
    ],
  },
  {
    titulo: "9. Confidencialidade",
    paras: [
      "As partes se comprometem a manter em sigilo as informações confidenciais a que tiverem acesso em razão do uso da Plataforma, empregando-as apenas para as finalidades previstas nestes Termos. A obrigação de confidencialidade subsiste ao término da relação, pelo prazo legalmente aplicável.",
    ],
  },
  {
    titulo: "10. Isenção de Garantias",
    paras: [
      "A Plataforma é fornecida no estado em que se encontra e conforme disponibilidade. A Operadora não garante que os Resultados estejam livres de imprecisões nem que sejam adequados a qualquer finalidade específica do Cliente.",
      "A Plataforma atua como uma ferramenta de agregação e síntese, coletando e processando dados e conteúdos públicos provenientes de fontes de terceiros (como redes sociais, fóruns e portais de notícias). A Operadora não endossa, não audita e não garante a veracidade, a legalidade, a exatidão ou a adequação das informações, opiniões e comentários gerados por esses terceiros. O Cliente reconhece que a Plataforma apenas organiza tais dados e que a Operadora é isenta de qualquer responsabilidade sobre o teor do conteúdo original raspado.",
      "Os Resultados têm natureza informativa e de apoio à decisão. Não constituem aconselhamento profissional, e a decisão de utilizá-los é de responsabilidade exclusiva do Cliente.",
    ],
  },
  {
    titulo: "11. Limitação de Responsabilidade",
    paras: [
      "Na máxima extensão permitida pela legislação aplicável, a Operadora não responde por danos indiretos, lucros cessantes, perda de dados, perda de receita ou de oportunidade decorrentes do uso ou da impossibilidade de uso da Plataforma ou dos Resultados.",
      "A responsabilidade total da Operadora, por qualquer causa relacionada à Plataforma, fica limitada ao valor efetivamente pago pelo Cliente à Operadora nos 12 (doze) meses anteriores ao evento que originou a responsabilidade.",
      "As limitações deste item não se aplicam a hipóteses que não admitam limitação por força de lei, tais como dolo, fraude ou violação de direitos de terceiros por conduta imputável à Operadora.",
    ],
  },
  {
    titulo: "12. Disponibilidade e Suporte",
    paras: [
      "A Operadora empenha esforços razoáveis para manter a Plataforma disponível, podendo realizar manutenções programadas ou emergenciais. Interrupções por caso fortuito, força maior ou por falhas de terceiros (por exemplo, provedores de infraestrutura e fontes de dados) não geram responsabilidade da Operadora.",
    ],
  },
  {
    titulo: "13. Vigência e Rescisão",
    paras: [
      "Estes Termos vigoram enquanto durar o acesso do Cliente à Plataforma. A Operadora pode suspender ou encerrar o acesso em caso de descumprimento destes Termos, de uso indevido ou de inadimplemento, sem prejuízo das demais medidas cabíveis.",
      "Encerrada a relação, cessa a licença de uso. A Operadora poderá reter dados pelo período necessário ao cumprimento de obrigações legais e regulatórias.",
    ],
  },
  {
    titulo: "14. Alterações dos Termos",
    paras: [
      "A Operadora pode atualizar estes Termos a qualquer tempo. A versão vigente é identificada pela data indicada nesta página. Alterações materiais serão comunicadas, e o uso continuado da Plataforma após a vigência da nova versão implica sua aceitação.",
    ],
  },
  {
    titulo: "15. Comunicações e Aceite Eletrônico",
    paras: [
      "O aceite destes Termos ocorre por meio eletrônico, no ato de ativação da conta ou do primeiro login, sendo registrados a data e a versão aceitas para fins de comprovação. As partes reconhecem a validade jurídica do aceite eletrônico, nos termos da legislação brasileira.",
    ],
  },
  {
    titulo: "16. Lei Aplicável e Foro",
    paras: [
      "Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro do domicílio da Operadora para dirimir controvérsias, salvo disposição diversa em contrato comercial específico entre as partes.",
    ],
  },
  {
    titulo: "17. Contato",
    paras: [
      `Dúvidas, solicitações relativas a dados pessoais ou comunicações sobre estes Termos devem ser dirigidas à Operadora, ${OPERADORA.nome}, CNPJ ${OPERADORA.cnpj}.`,
    ],
  },
];

// `dense` reduz a tipografia pro contexto de modal (o usuário pediu fonte menor).
export default function TermosContent({ dense = false }: { dense?: boolean }) {
  const secGap = dense ? "gap-6" : "gap-9";
  const tituloCls = dense ? "text-[14px]" : "text-[17px]";
  const corpoCls = dense ? "text-[13px]" : "text-[15px]";
  const itemGap = dense ? "gap-1.5" : "gap-2";

  return (
    <div className={`flex flex-col ${secGap}`}>
      {SECOES.map((secao) => (
        <section key={secao.titulo} className="flex flex-col gap-2.5">
          <h2 className={`text-white font-sans font-semibold ${tituloCls} tracking-[-0.01em]`}>
            {secao.titulo}
          </h2>
          {secao.paras?.map((p, i) => (
            <p key={i} className={`text-muted ${corpoCls} leading-relaxed`}>
              {p}
            </p>
          ))}
          {secao.itens && (
            <ul className={`flex flex-col ${itemGap} pl-4`}>
              {secao.itens.map((item, i) => (
                <li
                  key={i}
                  className={`text-muted ${corpoCls} leading-relaxed list-disc marker:text-muted-2`}
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
