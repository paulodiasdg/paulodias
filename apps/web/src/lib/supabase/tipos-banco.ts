export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      categorias: {
        Row: {
          criado_em: string;
          grupo: string;
          id: string;
          nome: string;
          padrao: boolean;
          slug: string;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          grupo: string;
          id?: string;
          nome: string;
          padrao?: boolean;
          slug: string;
          usuario_id?: string;
        };
        Update: {
          criado_em?: string;
          grupo?: string;
          id?: string;
          nome?: string;
          padrao?: boolean;
          slug?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      contas_avulsas: {
        Row: {
          categoria_id: string | null;
          criado_em: string;
          documento_id: string | null;
          id: string;
          lancamento_id: string | null;
          nome: string;
          pago_em: string | null;
          quita_itens: boolean;
          usuario_id: string;
          valor_centavos: number;
          vencimento: string;
        };
        ComputedFields: never;
        Insert: {
          categoria_id?: string | null;
          criado_em?: string;
          documento_id?: string | null;
          id?: string;
          lancamento_id?: string | null;
          nome: string;
          pago_em?: string | null;
          quita_itens?: boolean;
          usuario_id?: string;
          valor_centavos: number;
          vencimento: string;
        };
        Update: {
          categoria_id?: string | null;
          criado_em?: string;
          documento_id?: string | null;
          id?: string;
          lancamento_id?: string | null;
          nome?: string;
          pago_em?: string | null;
          quita_itens?: boolean;
          usuario_id?: string;
          valor_centavos?: number;
          vencimento?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contas_avulsas_usuario_id_categoria_id_fkey';
            columns: ['usuario_id', 'categoria_id'];
            isOneToOne: false;
            referencedRelation: 'categorias';
            referencedColumns: ['usuario_id', 'id'];
          },
          {
            foreignKeyName: 'contas_avulsas_usuario_id_documento_id_fkey';
            columns: ['usuario_id', 'documento_id'];
            isOneToOne: false;
            referencedRelation: 'documentos';
            referencedColumns: ['usuario_id', 'id'];
          },
          {
            foreignKeyName: 'contas_avulsas_usuario_id_lancamento_id_fkey';
            columns: ['usuario_id', 'lancamento_id'];
            isOneToOne: false;
            referencedRelation: 'lancamentos';
            referencedColumns: ['usuario_id', 'id'];
          },
        ];
      };
      documentos: {
        Row: {
          aprovado_em: string | null;
          arquivo_chave: string | null;
          criado_em: string;
          extracao_json: Json | null;
          hash: string;
          id: string;
          modelo_usado: string | null;
          nome: string;
          reenvio_confirmado: boolean;
          status: string;
          tipo: string | null;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          aprovado_em?: string | null;
          arquivo_chave?: string | null;
          criado_em?: string;
          extracao_json?: Json | null;
          hash: string;
          id?: string;
          modelo_usado?: string | null;
          nome: string;
          reenvio_confirmado?: boolean;
          status?: string;
          tipo?: string | null;
          usuario_id?: string;
        };
        Update: {
          aprovado_em?: string | null;
          arquivo_chave?: string | null;
          criado_em?: string;
          extracao_json?: Json | null;
          hash?: string;
          id?: string;
          modelo_usado?: string | null;
          nome?: string;
          reenvio_confirmado?: boolean;
          status?: string;
          tipo?: string | null;
          usuario_id?: string;
        };
        Relationships: [];
      };
      lancamentos: {
        Row: {
          categoria_id: string | null;
          conta_avulsa_id: string | null;
          criado_em: string;
          data: string;
          descricao: string;
          documento_id: string | null;
          id: string;
          ocorrencia_id: string | null;
          origem: string;
          tipo: string;
          usuario_id: string;
          valor_centavos: number;
        };
        ComputedFields: never;
        Insert: {
          categoria_id?: string | null;
          conta_avulsa_id?: string | null;
          criado_em?: string;
          data: string;
          descricao: string;
          documento_id?: string | null;
          id?: string;
          ocorrencia_id?: string | null;
          origem?: string;
          tipo: string;
          usuario_id?: string;
          valor_centavos: number;
        };
        Update: {
          categoria_id?: string | null;
          conta_avulsa_id?: string | null;
          criado_em?: string;
          data?: string;
          descricao?: string;
          documento_id?: string | null;
          id?: string;
          ocorrencia_id?: string | null;
          origem?: string;
          tipo?: string;
          usuario_id?: string;
          valor_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'lancamentos_usuario_id_categoria_id_fkey';
            columns: ['usuario_id', 'categoria_id'];
            isOneToOne: false;
            referencedRelation: 'categorias';
            referencedColumns: ['usuario_id', 'id'];
          },
          {
            foreignKeyName: 'lancamentos_usuario_id_conta_avulsa_id_fkey';
            columns: ['usuario_id', 'conta_avulsa_id'];
            isOneToOne: false;
            referencedRelation: 'contas_avulsas';
            referencedColumns: ['usuario_id', 'id'];
          },
          {
            foreignKeyName: 'lancamentos_usuario_id_documento_id_fkey';
            columns: ['usuario_id', 'documento_id'];
            isOneToOne: false;
            referencedRelation: 'documentos';
            referencedColumns: ['usuario_id', 'id'];
          },
          {
            foreignKeyName: 'lancamentos_usuario_id_ocorrencia_id_fkey';
            columns: ['usuario_id', 'ocorrencia_id'];
            isOneToOne: false;
            referencedRelation: 'ocorrencias';
            referencedColumns: ['usuario_id', 'id'];
          },
        ];
      };
      metas: {
        Row: {
          alvo_centavos: number;
          concluida_em: string | null;
          criado_em: string;
          id: string;
          nome: string;
          prazo: string;
          prioridade: number;
          tipo: string;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          alvo_centavos: number;
          concluida_em?: string | null;
          criado_em?: string;
          id?: string;
          nome: string;
          prazo: string;
          prioridade: number;
          tipo?: string;
          usuario_id?: string;
        };
        Update: {
          alvo_centavos?: number;
          concluida_em?: string | null;
          criado_em?: string;
          id?: string;
          nome?: string;
          prazo?: string;
          prioridade?: number;
          tipo?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      movimentos_reserva: {
        Row: {
          conta_avulsa_id: string | null;
          criado_em: string;
          data: string;
          destino: string;
          id: string;
          meta_id: string | null;
          ocorrencia_id: string | null;
          tipo: string;
          usuario_id: string;
          valor_centavos: number;
        };
        ComputedFields: never;
        Insert: {
          conta_avulsa_id?: string | null;
          criado_em?: string;
          data: string;
          destino: string;
          id?: string;
          meta_id?: string | null;
          ocorrencia_id?: string | null;
          tipo: string;
          usuario_id?: string;
          valor_centavos: number;
        };
        Update: {
          conta_avulsa_id?: string | null;
          criado_em?: string;
          data?: string;
          destino?: string;
          id?: string;
          meta_id?: string | null;
          ocorrencia_id?: string | null;
          tipo?: string;
          usuario_id?: string;
          valor_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'movimentos_reserva_usuario_id_conta_avulsa_id_fkey';
            columns: ['usuario_id', 'conta_avulsa_id'];
            isOneToOne: false;
            referencedRelation: 'contas_avulsas';
            referencedColumns: ['usuario_id', 'id'];
          },
          {
            foreignKeyName: 'movimentos_reserva_usuario_id_meta_id_fkey';
            columns: ['usuario_id', 'meta_id'];
            isOneToOne: false;
            referencedRelation: 'metas';
            referencedColumns: ['usuario_id', 'id'];
          },
          {
            foreignKeyName: 'movimentos_reserva_usuario_id_ocorrencia_id_fkey';
            columns: ['usuario_id', 'ocorrencia_id'];
            isOneToOne: false;
            referencedRelation: 'ocorrencias';
            referencedColumns: ['usuario_id', 'id'];
          },
        ];
      };
      ocorrencias: {
        Row: {
          competencia: string;
          criado_em: string;
          id: string;
          lancamento_id: string | null;
          pago_em: string | null;
          recorrencia_id: string;
          status: string;
          usuario_id: string;
          valor_centavos: number;
        };
        ComputedFields: never;
        Insert: {
          competencia: string;
          criado_em?: string;
          id?: string;
          lancamento_id?: string | null;
          pago_em?: string | null;
          recorrencia_id: string;
          status?: string;
          usuario_id?: string;
          valor_centavos: number;
        };
        Update: {
          competencia?: string;
          criado_em?: string;
          id?: string;
          lancamento_id?: string | null;
          pago_em?: string | null;
          recorrencia_id?: string;
          status?: string;
          usuario_id?: string;
          valor_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'ocorrencias_usuario_id_lancamento_id_fkey';
            columns: ['usuario_id', 'lancamento_id'];
            isOneToOne: false;
            referencedRelation: 'lancamentos';
            referencedColumns: ['usuario_id', 'id'];
          },
          {
            foreignKeyName: 'ocorrencias_usuario_id_recorrencia_id_fkey';
            columns: ['usuario_id', 'recorrencia_id'];
            isOneToOne: false;
            referencedRelation: 'recorrencias';
            referencedColumns: ['usuario_id', 'id'];
          },
        ];
      };
      perfis: {
        Row: {
          criado_em: string;
          guardar_original: boolean;
          nome: string;
          primeiro_acesso_concluido_em: string | null;
          teto_variavel_centavos: number | null;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          guardar_original?: boolean;
          nome: string;
          primeiro_acesso_concluido_em?: string | null;
          teto_variavel_centavos?: number | null;
          usuario_id?: string;
        };
        Update: {
          criado_em?: string;
          guardar_original?: boolean;
          nome?: string;
          primeiro_acesso_concluido_em?: string | null;
          teto_variavel_centavos?: number | null;
          usuario_id?: string;
        };
        Relationships: [];
      };
      recorrencias: {
        Row: {
          ativa: boolean;
          categoria_id: string | null;
          criado_em: string;
          dia: number;
          fim: string | null;
          id: string;
          inicio: string;
          nome: string;
          paga_no_cartao: boolean;
          renda_variavel: boolean;
          tipo: string;
          usuario_id: string;
          valor_centavos: number;
        };
        ComputedFields: never;
        Insert: {
          ativa?: boolean;
          categoria_id?: string | null;
          criado_em?: string;
          dia: number;
          fim?: string | null;
          id?: string;
          inicio: string;
          nome: string;
          paga_no_cartao?: boolean;
          renda_variavel?: boolean;
          tipo: string;
          usuario_id?: string;
          valor_centavos: number;
        };
        Update: {
          ativa?: boolean;
          categoria_id?: string | null;
          criado_em?: string;
          dia?: number;
          fim?: string | null;
          id?: string;
          inicio?: string;
          nome?: string;
          paga_no_cartao?: boolean;
          renda_variavel?: boolean;
          tipo?: string;
          usuario_id?: string;
          valor_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'recorrencias_usuario_id_categoria_id_fkey';
            columns: ['usuario_id', 'categoria_id'];
            isOneToOne: false;
            referencedRelation: 'categorias';
            referencedColumns: ['usuario_id', 'id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      confirmar_recebimento: {
        Args: {
          p_competencia: string;
          p_recebido_em: string;
          p_recorrencia_id: string;
          p_valor_centavos: number;
        };
        Returns: undefined;
      };
      desfazer_pagamento: {
        Args: { p_conta_avulsa_id?: string; p_ocorrencia_id?: string };
        Returns: undefined;
      };
      desfazer_recebimento: { Args: { p_ocorrencia_id: string }; Returns: undefined };
      excluir_meta: { Args: { p_meta_id: string }; Returns: undefined };
      registrar_pagamento: {
        Args: {
          p_competencia?: string;
          p_conta_avulsa_id?: string;
          p_pago_em: string;
          p_recorrencia_id?: string;
          p_saque_centavos: number;
          p_tipo_lancamento?: string;
          p_valor_centavos: number;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
