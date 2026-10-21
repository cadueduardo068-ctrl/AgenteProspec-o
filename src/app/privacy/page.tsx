export default function Privacy() {
  return (
    <main className="legal">
      <a href="/">← Voltar à CADU AI</a>
      <h1>Privacidade</h1>
      <p>
        A CADU AI é uma ferramenta de CRM de uso privado. O administrador é responsável por definir
        a finalidade, a base legal, o prazo de retenção e os canais para exercício de direitos antes
        de operar com dados reais.
      </p>
      <h2>Dados tratados</h2>
      <p>
        São armazenados cadastros comerciais verificados, evidências de consentimento, atividades
        confirmadas e resumos de análises. Conversas são fornecidas voluntariamente pelo
        administrador. Por padrão, o texto original analisado não é retido; a opção de retenção
        exige seleção expressa. A aplicação não acessa o WhatsApp pessoal.
      </p>
      <h2>Integrações e compartilhamento</h2>
      <p>
        Consultas podem ser enviadas ao Google Places e Brave Search. Quando configurado, o provedor
        OpenAI recebe os trechos selecionados para análise; o pedido usa store=false. A retenção
        contratual do provedor deve ser verificada pelo administrador. Resultados Google Places são
        temporários e não são gravados no CRM.{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
          Política de Privacidade do Google
        </a>
        .
      </p>
      <h2>Exclusão e controle</h2>
      <p>
        O administrador pode exportar registros, excluir análises e remover cadastros e histórico. A
        lista de exclusão permanece para impedir novo contato após uma recusa. Backups e retenção
        devem ser configurados na infraestrutura escolhida. Links wa.me abrem um serviço externo com
        o telefone e a mensagem previamente revisados.
      </p>
      <h2>Responsável e contato</h2>
      <p>
        {process.env.PRIVACY_CONTACT ||
          'O responsável deve configurar PRIVACY_CONTACT e publicar seus dados de identificação antes de disponibilizar este serviço para uso público.'}
      </p>
    </main>
  );
}
