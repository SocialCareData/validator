/*
 * The Social Care page: its own header and footer around the generic
 * validator component, configured with the Social Care standards.
 */

import './site.css'
import { config } from './config.js'
import { mountValidator } from './component/index.js'

const root = document.getElementById('validator')
if (!root) throw new Error('missing #validator')
mountValidator(root, config)
