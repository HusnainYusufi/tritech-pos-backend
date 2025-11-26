const AppError = require('../../../modules/AppError');
const TemplateRepo = require('../repository/template.repository');
const AnnRepo = require('../repository/announcement.repository');
const Template = require('../model/Template.model');

class CommunicationService {
  // Templates
  static async createTemplate(d){
    const exists = await TemplateRepo.getByName(d.name);
    if (exists) throw new AppError('Template name already exists', 409);
    const doc = await TemplateRepo.create(d);
    return { status: 200, message: 'Template created', result: doc };
  }
  static async updateTemplate(id, patch){
    const doc = await TemplateRepo.updateById(id, patch);
    if (!doc) throw new AppError('Template not found', 404);
    return { status: 200, message: 'Template updated', result: doc };
  }
  static async getTemplate(id){
    const doc = await TemplateRepo.getById(id);
    if (!doc) throw new AppError('Template not found', 404);
    return { status: 200, message: 'OK', result: doc };
  }
  static async listTemplates(q){
    const out = await TemplateRepo.search(q);
    return { status: 200, message: 'OK', ...out };
  }
  static async deleteTemplate(id){
    const doc = await TemplateRepo.deleteById(id);
    if (!doc) throw new AppError('Template not found', 404);
    return { status: 200, message: 'Template deleted' };
  }

  // Announcements
  static async createAnnouncement(d){
    const t = await Template.findById(d.templateId).lean();
    if (!t) throw new AppError('Template not found', 404);
    const doc = await AnnRepo.create({ ...d, status: d.scheduleAt ? 'scheduled' : 'draft' });
    return { status: 200, message: 'Announcement created', result: doc };
  }
  static async updateAnnouncement(id, patch){
    if (patch.templateId) {
      const t = await Template.findById(patch.templateId).lean();
      if (!t) throw new AppError('Template not found', 404);
    }
    const doc = await AnnRepo.updateById(id, patch);
    if (!doc) throw new AppError('Announcement not found', 404);
    return { status: 200, message: 'Announcement updated', result: doc };
  }
  static async getAnnouncement(id){
    const doc = await AnnRepo.getById(id);
    if (!doc) throw new AppError('Announcement not found', 404);
    return { status: 200, message: 'OK', result: doc };
  }
  static async listAnnouncements(q){
    const out = await AnnRepo.search(q);
    return { status: 200, message: 'OK', ...out };
  }
  static async deleteAnnouncement(id){
    const doc = await AnnRepo.deleteById(id);
    if (!doc) throw new AppError('Announcement not found', 404);
    return { status: 200, message: 'Announcement deleted' };
  }
}

module.exports = CommunicationService;
