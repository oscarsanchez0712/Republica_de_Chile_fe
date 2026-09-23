import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatriculaService } from '../../services/matricula.service';
import {
  Documentos,
  Matricula,
  crearDocumentosVacios,
} from '../../models/matricula.model';

const EXTENSIONES_PERMITIDAS = ['pdf', 'jpg', 'jpeg', 'png'];
const PATRON_NOMBRE = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]+$/;

type ClaveDocumento = keyof Documentos;

interface DocumentoCampo {
  clave: ClaveDocumento;
  nombre: string;
  descripcion: string;
}

@Component({
  selector: 'app-proceso-matricula',
  templateUrl: './proceso-matricula.component.html',
  styleUrls: ['./proceso-matricula.component.css'],
})
export class ProcesoMatriculaComponent {
  pasoActual = 1;
  totalPasos = 5;

  grados = [
    'Inicial 3 años', 'Inicial 4 años', 'Inicial 5 años',
    '1er Grado Primaria', '2do Grado Primaria', '3er Grado Primaria',
    '4to Grado Primaria', '5to Grado Primaria', '6to Grado Primaria',
    '1er Grado Secundaria', '2do Grado Secundaria', '3er Grado Secundaria',
    '4to Grado Secundaria', '5to Grado Secundaria',
  ];

  parentescos = ['Padre', 'Madre', 'Apoderado legal', 'Abuelo/a', 'Otro'];

  documentosCampos: DocumentoCampo[] = [
    { clave: 'partidaNacimiento', nombre: 'Partida de nacimiento', descripcion: 'Documento que acredita los datos del estudiante.' },
    { clave: 'dniEstudiante', nombre: 'DNI del estudiante', descripcion: 'Documento de identidad del estudiante.' },
    { clave: 'dniApoderado', nombre: 'DNI del apoderado', descripcion: 'Documento del responsable.' },
    { clave: 'constanciaEstudios', nombre: 'Constancia de estudios', descripcion: 'Documento que acredita los estudios realizados.' },
    { clave: 'foto', nombre: 'Foto tamaño carné', descripcion: 'Fotografía reciente del estudiante.' },
    { clave: 'fichaMatricula', nombre: 'Ficha de matrícula', descripcion: 'Ficha necesaria para completar el registro.' },
  ];

  documentos: Documentos = crearDocumentosVacios();
  erroresDocumentos: Partial<Record<ClaveDocumento, string>> = {};

  formEstudiante: FormGroup;
  formApoderado: FormGroup;

  numeroSolicitudGenerado = '';
  fechaGenerada = '';
  envioExitoso = false;

  constructor(private fb: FormBuilder, private matriculaService: MatriculaService) {
    this.formEstudiante = this.fb.group({
      nombres: ['', [Validators.required, Validators.pattern(PATRON_NOMBRE)]],
      apellidos: ['', [Validators.required, Validators.pattern(PATRON_NOMBRE)]],
      dni: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
      fechaNacimiento: ['', Validators.required],
      grado: ['', Validators.required],
      esNuevo: ['', Validators.required],
    });

    this.formApoderado = this.fb.group({
      nombreCompleto: ['', [Validators.required, Validators.pattern(PATRON_NOMBRE)]],
      dni: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
      telefono: ['', [Validators.required, Validators.pattern(/^\d{9}$/)]],
      correo: ['', [Validators.required, Validators.email]],
      parentesco: ['', Validators.required],
      direccion: ['', Validators.required],
    });
  }

  get porcentajeProgreso(): number {
    return (this.pasoActual / this.totalPasos) * 100;
  }

  limpiarTexto(evento: Event, formulario: FormGroup, campo: string): void {
    const input = evento.target as HTMLInputElement;
    const valorLimpio = input.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]/g, '');
    this.actualizarEntrada(input, formulario, campo, valorLimpio);
  }

  limpiarNumeros(evento: Event, formulario: FormGroup, campo: string): void {
    const input = evento.target as HTMLInputElement;
    const valorLimpio = input.value.replace(/\D/g, '');
    this.actualizarEntrada(input, formulario, campo, valorLimpio);
  }

  private actualizarEntrada(
    input: HTMLInputElement,
    formulario: FormGroup,
    campo: string,
    valor: string,
  ): void {
    input.value = valor;
    formulario.get(campo)?.setValue(valor, { emitEvent: false });
  }

  irAPaso(paso: number): void {
    if (paso < this.pasoActual) {
      this.pasoActual = paso;
    }
  }

  siguientePaso(): void {
    if (this.pasoActual === 1) {
      this.formEstudiante.markAllAsTouched();
      if (this.formEstudiante.invalid) {
        return;
      }
    }

    if (this.pasoActual === 2) {
      this.formApoderado.markAllAsTouched();
      if (this.formApoderado.invalid) {
        return;
      }
    }

    if (this.pasoActual === 3) {
      const todosAdjuntados = this.documentosCampos.every(
        (d) => this.documentos[d.clave].adjuntado
      );
      if (!todosAdjuntados) {
        this.documentosCampos.forEach((d) => {
          if (!this.documentos[d.clave].adjuntado) {
            this.erroresDocumentos[d.clave] = 'Debes adjuntar este documento.';
          }
        });
        return;
      }
    }

    if (this.pasoActual < this.totalPasos) {
      this.pasoActual++;
    }
  }

  pasoAnterior(): void {
    if (this.pasoActual > 1) {
      this.pasoActual--;
    }
  }

  seleccionarArchivo(evento: Event, clave: ClaveDocumento): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files && input.files.length > 0 ? input.files[0] : null;

    if (!archivo) {
      return;
    }

    const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';

    if (!EXTENSIONES_PERMITIDAS.includes(extension)) {
      this.erroresDocumentos[clave] = 'Formato no permitido. Solo PDF, JPG, JPEG o PNG.';
      this.documentos[clave] = { nombreArchivo: '', tipo: '', adjuntado: false };
      input.value = '';
      return;
    }

    delete this.erroresDocumentos[clave];
    this.documentos[clave] = {
      nombreArchivo: archivo.name,
      tipo: extension,
      adjuntado: true,
    };
  }

  enviarSolicitud(): void {
    const numeroSolicitud = this.matriculaService.generarNumeroSolicitud();
    const fecha = new Date().toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const nuevaMatricula: Matricula = {
      numeroSolicitud,
      fecha,
      estudiante: {
        nombres: this.formEstudiante.value.nombres,
        apellidos: this.formEstudiante.value.apellidos,
        dni: this.formEstudiante.value.dni,
        fechaNacimiento: this.formEstudiante.value.fechaNacimiento,
        grado: this.formEstudiante.value.grado,
        esNuevo: this.formEstudiante.value.esNuevo === 'si',
      },
      apoderado: {
        nombreCompleto: this.formApoderado.value.nombreCompleto,
        dni: this.formApoderado.value.dni,
        telefono: this.formApoderado.value.telefono,
        correo: this.formApoderado.value.correo,
        parentesco: this.formApoderado.value.parentesco,
        direccion: this.formApoderado.value.direccion,
      },
      documentos: this.documentos,
      estado: 'EN REVISIÓN',
    };

    this.matriculaService.guardarMatricula(nuevaMatricula);

    this.numeroSolicitudGenerado = numeroSolicitud;
    this.fechaGenerada = fecha;
    this.envioExitoso = true;
    this.pasoActual = 5;
  }

  nuevaMatricula(): void {
    this.formEstudiante.reset();
    this.formApoderado.reset();
    this.documentos = crearDocumentosVacios();
    this.erroresDocumentos = {};
    this.envioExitoso = false;
    this.numeroSolicitudGenerado = '';
    this.pasoActual = 1;
  }

  mensajeErrorEstudiante(campo: string): string {
    const control = this.formEstudiante.get(campo);
    if (!control || !control.touched || !control.errors) {
      return '';
    }
    if (control.errors['required']) {
      return 'Este campo es obligatorio.';
    }
    if (control.errors['pattern'] && campo === 'dni') {
      return 'El DNI debe contener 8 dígitos.';
    }
    return 'Dato inválido.';
  }

  mensajeErrorApoderado(campo: string): string {
    const control = this.formApoderado.get(campo);
    if (!control || !control.touched || !control.errors) {
      return '';
    }
    if (control.errors['required']) {
      return 'Este campo es obligatorio.';
    }
    if (control.errors['pattern'] && campo === 'dni') {
      return 'El DNI debe contener 8 dígitos.';
    }
    if (control.errors['pattern'] && campo === 'telefono') {
      return 'El teléfono debe contener 9 dígitos.';
    }
    if (control.errors['email']) {
      return 'Ingresa un correo electrónico válido.';
    }
    return 'Dato inválido.';
  }
}
