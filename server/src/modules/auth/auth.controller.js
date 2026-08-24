import { success } from '../../shared/response.js';
import * as authService from './auth.service.js';
export async function register(req, res, next) { try { res.status(201).json(success(await authService.register(req.body))); } catch (error) { next(error); } }
export async function login(req, res, next) { try { res.json(success(await authService.login(req.body))); } catch (error) { next(error); } }
export async function refresh(req, res, next) { try { res.json(success(await authService.refresh(req.body.refreshToken))); } catch (error) { next(error); } }
export async function logout(req, res, next) { try { await authService.logout(req.body.refreshToken); res.status(204).end(); } catch (error) { next(error); } }
export async function me(req, res, next) { try { res.json(success(await authService.getUserById(req.user.id))); } catch (error) { next(error); } }
