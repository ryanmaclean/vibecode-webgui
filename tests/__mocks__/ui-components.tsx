// Mock UI components for testing
import React from 'react'

export const Button = ({ children, ...props }: any) => <button {...props}>{children}</button>
export const Card = ({ children, ...props }: any) => <div {...props}>{children}</div>
export const CardContent = ({ children, ...props }: any) => <div {...props}>{children}</div>
export const CardDescription = ({ children, ...props }: any) => <div {...props}>{children}</div>
export const CardHeader = ({ children, ...props }: any) => <div {...props}>{children}</div>
export const CardTitle = ({ children, ...props }: any) => <h3 {...props}>{children}</h3>
export const Input = (props: any) => <input {...props} />
export const Textarea = (props: any) => <textarea {...props} />
export const Label = ({ children, ...props }: any) => <label {...props}>{children}</label>
export const Select = ({ children, ...props }: any) => <select {...props}>{children}</select>
export const SelectContent = ({ children, ...props }: any) => <div {...props}>{children}</div>
export const SelectItem = ({ children, ...props }: any) => <option {...props}>{children}</option>
export const SelectTrigger = ({ children, ...props }: any) => <div {...props}>{children}</div>
export const SelectValue = ({ children, ...props }: any) => <span {...props}>{children}</span>
export const Badge = ({ children, ...props }: any) => <span {...props}>{children}</span>
export const Progress = (props: any) => <div role="progressbar" {...props} />
export const Alert = ({ children, ...props }: any) => <div {...props}>{children}</div>
export const AlertDescription = ({ children, ...props }: any) => <div {...props}>{children}</div>