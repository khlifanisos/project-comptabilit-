<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\FactureAchatController;
use App\Http\Controllers\FactureVenteController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReleveBancaireController;
use App\Http\Controllers\DeclarationFiscaleController;
use App\Http\Controllers\DeclarationSocialeController;
use App\Http\Controllers\EcheancierLeasingController;
use App\Http\Controllers\AuditController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\InvoiceAnalysisController;
use App\Http\Controllers\ExcelExportController;
use App\Http\Controllers\TicketController;
use App\Http\Controllers\AdminDocumentController;
use App\Http\Controllers\ParametreController;
use App\Http\Controllers\TexteLoiController;
use App\Http\Controllers\MessageController;

// ── Public auth routes ──────────────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('/send-verification', [AuthController::class, 'sendVerificationCode']);
    Route::post('/register',          [AuthController::class, 'register']);
    Route::post('/login',             [AuthController::class, 'login']);
    Route::post('/forgot-password',   [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password',    [AuthController::class, 'resetPassword']);
});

// Public app settings (currency, WhatsApp support number) — no sensitive data
Route::get('/parametres', [ParametreController::class, 'show']);

// ── Protected routes ─────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me',      [AuthController::class, 'me']);

    // Messages (client ↔ admin chat)
    Route::get('/messages/conversations',                    [MessageController::class, 'conversations']);
    Route::get('/messages/unread-count',                     [MessageController::class, 'unreadCount']);
    Route::get('/messages/{clientId}/attachment/{messageId}', [MessageController::class, 'attachment']);
    Route::get('/messages/{clientId}',                        [MessageController::class, 'index']);
    Route::post('/messages/{clientId}',                       [MessageController::class, 'store']);

    // Notifications
    Route::get('/notifications',                [NotificationController::class, 'index']);
    Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllRead']);
    Route::patch('/notifications/{id}/read',    [NotificationController::class, 'markRead']);
    Route::delete('/notifications/all',         [NotificationController::class, 'destroyAll']);
    Route::delete('/notifications/{id}',        [NotificationController::class, 'destroy']);

    // Invoice AI analysis & Excel generation
    Route::post('/factures-achats/analyze', [InvoiceAnalysisController::class, 'analyze']);
    Route::post('/factures-achats/excel',   [InvoiceAnalysisController::class, 'excel']);

    // Factures achats
    Route::get('/factures-achats',                [FactureAchatController::class, 'index']);
    Route::post('/factures-achats',               [FactureAchatController::class, 'store']);
    Route::get('/factures-achats/export',         [FactureAchatController::class, 'export']);
    Route::get('/factures-achats/export-excel',    [FactureAchatController::class, 'exportExcel']);
    Route::get('/factures-achats/export-excel-ai', [FactureAchatController::class, 'exportExcelAi']);
    Route::get('/factures-achats/{id}',           [FactureAchatController::class, 'show']);
    Route::get('/factures-achats/{id}/image',     [FactureAchatController::class, 'image']);
    Route::put('/factures-achats/{id}',           [FactureAchatController::class, 'update']);
    Route::delete('/factures-achats/{id}',        [FactureAchatController::class, 'destroy']);

    // Invoice AI analysis & Excel generation (ventes)
    Route::post('/factures-ventes/analyze', [InvoiceAnalysisController::class, 'analyze']);
    Route::post('/factures-ventes/excel',   [InvoiceAnalysisController::class, 'excel']);

    // Factures ventes
    Route::get('/factures-ventes',                [FactureVenteController::class, 'index']);
    Route::post('/factures-ventes',               [FactureVenteController::class, 'store']);
    Route::get('/factures-ventes/export',            [FactureVenteController::class, 'export']);
    Route::get('/factures-ventes/export-excel',      [FactureVenteController::class, 'exportExcel']);
    Route::get('/factures-ventes/export-excel-ai',   [FactureVenteController::class, 'exportExcelAi']);
    Route::get('/factures-ventes/{id}',           [FactureVenteController::class, 'show']);
    Route::get('/factures-ventes/{id}/image',     [FactureVenteController::class, 'image']);
    Route::put('/factures-ventes/{id}',           [FactureVenteController::class, 'update']);
    Route::delete('/factures-ventes/{id}',        [FactureVenteController::class, 'destroy']);

    // Relevés bancaires
    Route::get('/releves-bancaires',                [ReleveBancaireController::class, 'index']);
    Route::post('/releves-bancaires',               [ReleveBancaireController::class, 'store']);
    Route::get('/releves-bancaires/export',         [ReleveBancaireController::class, 'export']);
    Route::get('/releves-bancaires/export-excel',   [ReleveBancaireController::class, 'exportExcel']);
    Route::post('/releves-bancaires/import-file',   [ReleveBancaireController::class, 'importFile']);
    Route::put('/releves-bancaires/{id}',           [ReleveBancaireController::class, 'update']);
    Route::delete('/releves-bancaires/{id}',        [ReleveBancaireController::class, 'destroy']);

    // Déclarations fiscales
    Route::get('/declarations-fiscales',                [DeclarationFiscaleController::class, 'index']);
    Route::post('/declarations-fiscales',               [DeclarationFiscaleController::class, 'store']);
    Route::get('/declarations-fiscales/export',         [DeclarationFiscaleController::class, 'export']);
    Route::get('/declarations-fiscales/export-excel',   [DeclarationFiscaleController::class, 'exportExcel']);
    Route::put('/declarations-fiscales/{id}',           [DeclarationFiscaleController::class, 'update']);
    Route::delete('/declarations-fiscales/{id}',        [DeclarationFiscaleController::class, 'destroy']);

    // Déclarations sociales
    Route::get('/declarations-sociales',                    [DeclarationSocialeController::class, 'index']);
    Route::post('/declarations-sociales',                   [DeclarationSocialeController::class, 'store']);
    Route::get('/declarations-sociales/export',             [DeclarationSocialeController::class, 'export']);
    Route::get('/declarations-sociales/export-excel',       [DeclarationSocialeController::class, 'exportExcel']);
    Route::post('/declarations-sociales/export-pdf',        [DeclarationSocialeController::class, 'exportPdf']);
    Route::get('/declarations-sociales/{id}',               [DeclarationSocialeController::class, 'show']); 
    Route::put('/declarations-sociales/{id}',               [DeclarationSocialeController::class, 'update']);
    Route::delete('/declarations-sociales/{id}',            [DeclarationSocialeController::class, 'destroy']);
    Route::post('/declarations-sociales/{id}/viewed',       [DeclarationSocialeController::class, 'markViewed']);
    Route::get('/declarations-sociales/{id}/pdf',           [DeclarationSocialeController::class, 'downloadPdf']);
    Route::get('/declarations-sociales/{id}/fichier',       [DeclarationSocialeController::class, 'fichier']);

    // Échéancier leasing
    Route::get('/echeanciers-leasing',                [EcheancierLeasingController::class, 'index']);
    Route::post('/echeanciers-leasing',               [EcheancierLeasingController::class, 'store']);
    Route::get('/echeanciers-leasing/export',         [EcheancierLeasingController::class, 'export']);
    Route::get('/echeanciers-leasing/export-excel',   [EcheancierLeasingController::class, 'exportExcel']);
    Route::post('/echeanciers-leasing/export-pdf',    [EcheancierLeasingController::class, 'exportPdf']);
    Route::put('/echeanciers-leasing/{id}',           [EcheancierLeasingController::class, 'update']);
    Route::delete('/echeanciers-leasing/{id}',        [EcheancierLeasingController::class, 'destroy']);

    // Paramètres (devise)
    Route::put('/parametres', [ParametreController::class, 'update']);

    // Profile
    Route::put('/profile',               [ProfileController::class, 'update']);
    Route::put('/profile/password',      [ProfileController::class, 'updatePassword']);
    Route::post('/profile/photo',        [ProfileController::class, 'updatePhoto']);
    Route::put('/profile/notifications', [ProfileController::class, 'updateNotifications']);

    // Audit intelligent
    Route::get('/audit', [AuditController::class, 'index']);
    Route::get('/audit/ai-summary', [AuditController::class, 'aiSummary']);

    // Tickets (super admin assigne, admin exécute, super admin valide)
    Route::get('/tickets',                  [TicketController::class, 'index']);
    Route::get('/tickets/assignable-admins', [TicketController::class, 'assignableAdmins']);
    Route::post('/tickets',                 [TicketController::class, 'store']);
    Route::put('/tickets/{id}',             [TicketController::class, 'update']);
    Route::delete('/tickets/{id}',          [TicketController::class, 'destroy']);
    Route::post('/tickets/{id}/start',      [TicketController::class, 'start']);
    Route::post('/tickets/{id}/submit',     [TicketController::class, 'submit']);
    Route::post('/tickets/{id}/validate',   [TicketController::class, 'validateTicket']);
    Route::post('/tickets/{id}/reject',     [TicketController::class, 'reject']);
    Route::post('/tickets/{id}/attachments',                    [TicketController::class, 'uploadAttachment']);
    Route::get('/tickets/{id}/attachments/{attachmentId}/fichier', [TicketController::class, 'downloadAttachment']);
    Route::delete('/tickets/{id}/attachments/{attachmentId}',   [TicketController::class, 'deleteAttachment']);

    // Fichiers Excel archivés (analyses de factures converties)
    Route::get('/excel-exports',              [ExcelExportController::class, 'index']);
    Route::get('/excel-exports/{id}/fichier', [ExcelExportController::class, 'fichier']);
    Route::delete('/excel-exports/{id}',      [ExcelExportController::class, 'destroy']);

    // Textes et lois (admin)
    Route::get('/textes-lois',              [TexteLoiController::class, 'index']);
    Route::post('/textes-lois',             [TexteLoiController::class, 'store']);
    Route::get('/textes-lois/{id}/fichier', [TexteLoiController::class, 'fichier']);
    Route::delete('/textes-lois/{id}',      [TexteLoiController::class, 'destroy']);

    // Admin — document actions
    Route::post('/admin/documents/notify-rename',           [AdminDocumentController::class, 'notifyRename']);
    Route::patch('/admin/documents/{source}/{id}/status',   [AdminDocumentController::class, 'updateStatus']);

    // Admin — gestion clients
    Route::get('/admin/clients',                    [ClientController::class, 'index']);
    Route::get('/admin/clients/pending',            [ClientController::class, 'pending']);
    Route::post('/admin/clients/invite',            [ClientController::class, 'invite']);
    Route::put('/admin/clients/{id}',               [ClientController::class, 'update']);
    Route::delete('/admin/clients/{id}',            [ClientController::class, 'destroy']);
    Route::patch('/admin/clients/{id}/toggle',      [ClientController::class, 'toggleActive']);
    Route::post('/admin/clients/{id}/impersonate',  [ClientController::class, 'impersonate']);
    Route::post('/admin/clients/{id}/send-email',   [ClientController::class, 'sendEmail']);
    Route::post('/admin/clients/{id}/approve',      [ClientController::class, 'approve']);
});