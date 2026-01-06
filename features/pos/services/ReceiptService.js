// features/pos/services/ReceiptService.js
'use strict';

const moment = require('moment');
const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');
const PosOrderRepo = require('../repository/posOrder.repository');
const BranchRepo = require('../../branch/repository/branch.repository');
const TenantUserRepo = require('../../tenant-auth/repository/tenantUser.repository');

/**
 * Production-grade Receipt Generation Service
 * Supports HTML, plain text, and thermal printer formats
 */
class ReceiptService {
  /**
   * Generate receipt for an order
   * 
   * @param {Connection} conn - Tenant database connection
   * @param {string} orderId - Order ID
   * @param {string} format - Receipt format: 'html', 'text', 'thermal'
   * @returns {Promise<Object>} Receipt data
   */
  static async generateReceipt(conn, orderId, format = 'html') {
    // Fetch order with populated references
    const PosOrder = PosOrderRepo.model(conn);
    const orderDoc = await PosOrder.findById(orderId)
      .populate('branchId', 'name code address contact tax posConfig')
      .populate('staffId', 'fullName')
      .lean();

    if (!orderDoc) {
      throw new AppError('Order not found', 404);
    }

    // Get branch details
    const branch = orderDoc.branchId;
    if (!branch) {
      throw new AppError('Branch information not found', 404);
    }

    // Get receipt config from branch
    const receiptConfig = branch.posConfig?.receiptConfig || {};
    
    // Build receipt data
    const receiptData = {
      orderNumber: orderDoc.orderNumber,
      orderDate: moment(orderDoc.createdAt).format('DD/MM/YYYY HH:mm:ss'),
      branchName: branch.name,
      branchAddress: this._formatAddress(branch.address),
      branchPhone: branch.contact?.phone || '',
      branchEmail: branch.contact?.email || '',
      vatNumber: branch.tax?.vatNumber || '',
      cashierName: orderDoc.staffId?.fullName || 'Staff',
      customerName: orderDoc.customerName || 'Walk-in Customer',
      customerPhone: orderDoc.customerPhone || '',
      items: orderDoc.items.map(item => ({
        name: item.nameSnapshot,
        code: receiptConfig.showItemCodes ? item.codeSnapshot : null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        notes: item.notes || ''
      })),
      subTotal: orderDoc.totals.subTotal,
      taxTotal: orderDoc.totals.taxTotal,
      discount: orderDoc.totals.discount || 0,
      grandTotal: orderDoc.totals.grandTotal,
      currency: orderDoc.pricingSnapshot.currency || 'SAR',
      taxMode: orderDoc.pricingSnapshot.taxMode || 'exclusive',
      taxRate: orderDoc.pricingSnapshot.taxRate || 0,
      paymentMethod: orderDoc.payment?.method || 'cash',
      amountPaid: orderDoc.payment?.amountPaid || 0,
      change: orderDoc.payment?.change || 0,
      status: orderDoc.status,
      // Receipt customization from branch config
      config: {
        showLogo: receiptConfig.showLogo || false,
        logoUrl: receiptConfig.logoUrl || '',
        showQRCode: receiptConfig.showQRCode || false,
        qrCodeData: receiptConfig.qrCodeData || '',
        headerText: receiptConfig.headerText || '',
        footerText: receiptConfig.footerText || branch.posConfig?.receiptFooter || 'Thank you for your business!',
        showTaxBreakdown: receiptConfig.showTaxBreakdown !== false,
        showItemCodes: receiptConfig.showItemCodes || false,
        paperWidth: receiptConfig.paperWidth || 80,
        fontSizeMultiplier: receiptConfig.fontSizeMultiplier || 1.0
      }
    };

    // Generate receipt in requested format
    switch (format.toLowerCase()) {
      case 'html':
        return {
          format: 'html',
          content: this._generateHTML(receiptData),
          data: receiptData
        };
      case 'text':
        return {
          format: 'text',
          content: this._generateText(receiptData),
          data: receiptData
        };
      case 'thermal':
        return {
          format: 'thermal',
          content: this._generateThermal(receiptData),
          data: receiptData
        };
      default:
        throw new AppError('Invalid receipt format. Use: html, text, or thermal', 400);
    }
  }

  /**
   * Format address for receipt
   */
  static _formatAddress(address) {
    if (!address) return '';
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.postalCode,
      address.country
    ].filter(Boolean);
    return parts.join(', ');
  }

  /**
   * Generate HTML receipt (for web/email)
   */
  static _generateHTML(data) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - ${data.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Courier New', monospace; 
      font-size: 14px; 
      line-height: 1.6;
      padding: 20px;
      max-width: 400px;
      margin: 0 auto;
    }
    .receipt { 
      border: 2px solid #000; 
      padding: 20px;
      background: #fff;
    }
    .header { 
      text-align: center; 
      border-bottom: 2px dashed #000;
      padding-bottom: 15px;
      margin-bottom: 15px;
    }
    .header h1 { 
      font-size: 24px; 
      font-weight: bold;
      margin-bottom: 5px;
    }
    .header p { 
      font-size: 12px; 
      margin: 2px 0;
    }
    .section { 
      margin: 15px 0;
      padding: 10px 0;
      border-bottom: 1px dashed #000;
    }
    .section:last-child { border-bottom: none; }
    .row { 
      display: flex; 
      justify-content: space-between;
      margin: 5px 0;
    }
    .items-table { 
      width: 100%; 
      margin: 10px 0;
    }
    .items-table th {
      text-align: left;
      border-bottom: 1px solid #000;
      padding: 5px 0;
    }
    .items-table td {
      padding: 5px 0;
      vertical-align: top;
    }
    .item-name { width: 50%; }
    .item-qty { width: 15%; text-align: center; }
    .item-price { width: 20%; text-align: right; }
    .item-total { width: 15%; text-align: right; }
    .totals { 
      margin-top: 15px;
      padding-top: 10px;
      border-top: 2px solid #000;
    }
    .totals .row { 
      font-size: 14px;
      margin: 8px 0;
    }
    .totals .grand-total { 
      font-size: 18px; 
      font-weight: bold;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 2px solid #000;
    }
    .footer { 
      text-align: center; 
      margin-top: 20px;
      padding-top: 15px;
      border-top: 2px dashed #000;
      font-size: 12px;
    }
    .status-badge {
      display: inline-block;
      padding: 5px 10px;
      border-radius: 4px;
      font-weight: bold;
      margin-top: 10px;
    }
    .status-paid { background: #4CAF50; color: white; }
    .status-placed { background: #FFC107; color: #000; }
    .status-void { background: #F44336; color: white; }
    @media print {
      body { padding: 0; }
      .receipt { border: none; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>${data.branchName}</h1>
      <p>${data.branchAddress}</p>
      ${data.branchPhone ? `<p>Tel: ${data.branchPhone}</p>` : ''}
      ${data.branchEmail ? `<p>Email: ${data.branchEmail}</p>` : ''}
      ${data.vatNumber ? `<p>VAT: ${data.vatNumber}</p>` : ''}
    </div>

    <div class="section">
      <div class="row">
        <span><strong>Order #:</strong></span>
        <span>${data.orderNumber}</span>
      </div>
      <div class="row">
        <span><strong>Date:</strong></span>
        <span>${data.orderDate}</span>
      </div>
      <div class="row">
        <span><strong>Cashier:</strong></span>
        <span>${data.cashierName}</span>
      </div>
      ${data.customerName !== 'Walk-in Customer' ? `
      <div class="row">
        <span><strong>Customer:</strong></span>
        <span>${data.customerName}</span>
      </div>
      ` : ''}
      ${data.customerPhone ? `
      <div class="row">
        <span><strong>Phone:</strong></span>
        <span>${data.customerPhone}</span>
      </div>
      ` : ''}
      <div style="text-align: center;">
        <span class="status-badge status-${data.status}">${data.status.toUpperCase()}</span>
      </div>
    </div>

    <div class="section">
      <table class="items-table">
        <thead>
          <tr>
            <th class="item-name">Item</th>
            <th class="item-qty">Qty</th>
            <th class="item-price">Price</th>
            <th class="item-total">Total</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map(item => `
          <tr>
            <td class="item-name">
              ${item.name}
              ${item.notes ? `<br><small style="color: #666;">${item.notes}</small>` : ''}
            </td>
            <td class="item-qty">${item.quantity}</td>
            <td class="item-price">${this._formatCurrency(item.unitPrice, data.currency)}</td>
            <td class="item-total">${this._formatCurrency(item.lineTotal, data.currency)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="totals">
      <div class="row">
        <span>Subtotal:</span>
        <span>${this._formatCurrency(data.subTotal, data.currency)}</span>
      </div>
      ${data.discount > 0 ? `
      <div class="row">
        <span>Discount:</span>
        <span>-${this._formatCurrency(data.discount, data.currency)}</span>
      </div>
      ` : ''}
      ${data.taxTotal > 0 ? `
      <div class="row">
        <span>Tax (${data.taxRate}%):</span>
        <span>${this._formatCurrency(data.taxTotal, data.currency)}</span>
      </div>
      ` : ''}
      <div class="row grand-total">
        <span>TOTAL:</span>
        <span>${this._formatCurrency(data.grandTotal, data.currency)}</span>
      </div>
      ${data.status === 'paid' ? `
      <div class="row" style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #000;">
        <span>Payment (${data.paymentMethod.toUpperCase()}):</span>
        <span>${this._formatCurrency(data.amountPaid, data.currency)}</span>
      </div>
      ${data.change > 0 ? `
      <div class="row">
        <span>Change:</span>
        <span>${this._formatCurrency(data.change, data.currency)}</span>
      </div>
      ` : ''}
      ` : ''}
    </div>

    <div class="footer">
      <p>${data.receiptFooter}</p>
      <p style="margin-top: 10px; font-size: 10px;">
        Powered by Tritech POS
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text receipt (for thermal printers)
   */
  static _generateText(data) {
    const width = 42; // Standard thermal printer width
    const line = '='.repeat(width);
    const dashLine = '-'.repeat(width);

    let receipt = '';
    
    // Header
    receipt += this._center(data.branchName, width) + '\n';
    receipt += this._center(data.branchAddress, width) + '\n';
    if (data.branchPhone) receipt += this._center(`Tel: ${data.branchPhone}`, width) + '\n';
    if (data.vatNumber) receipt += this._center(`VAT: ${data.vatNumber}`, width) + '\n';
    receipt += line + '\n';

    // Order info
    receipt += `Order #: ${data.orderNumber}\n`;
    receipt += `Date: ${data.orderDate}\n`;
    receipt += `Cashier: ${data.cashierName}\n`;
    if (data.customerName !== 'Walk-in Customer') {
      receipt += `Customer: ${data.customerName}\n`;
    }
    receipt += `Status: ${data.status.toUpperCase()}\n`;
    receipt += dashLine + '\n';

    // Items
    receipt += this._pad('Item', 'Qty', 'Price', 'Total', width) + '\n';
    receipt += dashLine + '\n';
    
    data.items.forEach(item => {
      receipt += this._wrapText(item.name, width) + '\n';
      receipt += this._pad(
        '',
        String(item.quantity),
        this._formatCurrency(item.unitPrice, data.currency),
        this._formatCurrency(item.lineTotal, data.currency),
        width
      ) + '\n';
      if (item.notes) {
        receipt += `  Note: ${item.notes}\n`;
      }
    });

    receipt += dashLine + '\n';

    // Totals
    receipt += this._rightAlign(`Subtotal: ${this._formatCurrency(data.subTotal, data.currency)}`, width) + '\n';
    if (data.discount > 0) {
      receipt += this._rightAlign(`Discount: -${this._formatCurrency(data.discount, data.currency)}`, width) + '\n';
    }
    if (data.taxTotal > 0) {
      receipt += this._rightAlign(`Tax (${data.taxRate}%): ${this._formatCurrency(data.taxTotal, data.currency)}`, width) + '\n';
    }
    receipt += line + '\n';
    receipt += this._rightAlign(`TOTAL: ${this._formatCurrency(data.grandTotal, data.currency)}`, width) + '\n';
    receipt += line + '\n';

    // Payment
    if (data.status === 'paid') {
      receipt += this._rightAlign(`Paid (${data.paymentMethod.toUpperCase()}): ${this._formatCurrency(data.amountPaid, data.currency)}`, width) + '\n';
      if (data.change > 0) {
        receipt += this._rightAlign(`Change: ${this._formatCurrency(data.change, data.currency)}`, width) + '\n';
      }
      receipt += dashLine + '\n';
    }

    // Footer
    receipt += '\n';
    receipt += this._center(data.receiptFooter, width) + '\n';
    receipt += '\n';
    receipt += this._center('Powered by Tritech POS', width) + '\n';

    return receipt;
  }

  /**
   * Generate thermal printer format (ESC/POS commands)
   */
  static _generateThermal(data) {
    // For now, return text format
    // In production, this would include ESC/POS commands
    return this._generateText(data);
  }

  /**
   * Helper: Format currency
   */
  static _formatCurrency(amount, currency = 'SAR') {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }

  /**
   * Helper: Center text
   */
  static _center(text, width) {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  /**
   * Helper: Right align text
   */
  static _rightAlign(text, width) {
    const padding = Math.max(0, width - text.length);
    return ' '.repeat(padding) + text;
  }

  /**
   * Helper: Pad columns
   */
  static _pad(col1, col2, col3, col4, width) {
    const col1Width = Math.floor(width * 0.4);
    const col2Width = 4;
    const col3Width = Math.floor(width * 0.25);
    const col4Width = width - col1Width - col2Width - col3Width - 2;

    return (
      col1.padEnd(col1Width) + ' ' +
      col2.padStart(col2Width) + ' ' +
      col3.padStart(col3Width) + ' ' +
      col4.padStart(col4Width)
    );
  }

  /**
   * Helper: Wrap text to width
   */
  static _wrapText(text, width) {
    if (text.length <= width) return text;
    return text.substring(0, width - 3) + '...';
  }
}

module.exports = ReceiptService;

