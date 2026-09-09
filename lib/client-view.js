function buildClientView(record, relatedNames) {
  const groupIds = record['Grupo / Cliente matriz'] || [];
  const grupoNombre = groupIds.length
    ? groupIds.map((id) => relatedNames[id]).filter(Boolean).join(', ') || null
    : null;

  return {
    header: {
      nombre: record['Nombre'] || null,
      contactoPrincipal: record['Contacto principal'] || null,
      etapa: record['Etapa'] || null,
      proximoSeguimiento: record['Proximo seguimiento'] || null,
    },
    tabs: {
      infoGeneral: {
        tipoDeNegocio: record['Tipo de negocio'] || null,
        canalOrigen: record['Canal origen'] || null,
        fuenteDelLead: record['Fuente del lead'] || null,
        comuna: record['Comuna'] || null,
        region: record['Region'] || null,
        ejecutivo: record['Ejecutivo'] || null,
        numeroDeLocales: record['Numero de locales'] ?? null,
        telefono: record['Teléfono'] || null,
        telefono2: record['Teléfono 2'] || null,
        email: record['Email'] || null,
        email2: record['Email 2'] || null,
        cargo: record['Cargo'] || null,
        notas: record['Notas'] || null,
        grupoNombre,
      },
      fichaGoogle: { sinDatos: true },
      pruebaPago: {
        fechaInicioPrueba: record['Fecha inicio prueba'] || null,
        fechaInicioContrato: record['Fecha inicio contrato'] || null,
        fechaRenovacion: record['Fecha renovacion'] || null,
        contratoFirmado: record['Contrato firmado'] === true,
        montoMensual: record['Monto mensual'] ?? null,
        moneda: record['Moneda'] || null,
        modulosActivos: record['Modulos activos'] || [],
        estadoComercial: record['Estado comercial'] || null,
      },
      facturacion: {
        rut: record['RUT'] || null,
        razonSocial: record['Razon social'] || null,
        direccionLegal: record['Direccion legal'] || null,
        giro: record['Giro'] || null,
        sinDatos: !record['RUT'] && !record['Razon social'],
      },
      historial: {
        fechaPrimerContacto: record['Fecha primer contacto'] || null,
        fechaIngresoPipeline: record['Fecha ingreso pipeline'] || null,
        ultimoContacto: record['Ultimo contacto'] || null,
        ultimaReunion: record['Ultima reunion'] || null,
        fechaOnboardingCompletado: record['Fecha onboarding completado'] || null,
        fechaChurn: record['Fecha churn'] || null,
        motivoChurn: record['Motivo churn'] || null,
        motivoPerdida: record['Motivo perdida'] || null,
        enRiesgo: record['En riesgo'] === true,
      },
    },
  };
}

module.exports = { buildClientView };
