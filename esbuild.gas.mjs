import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// GAS用のビルド設定
const buildConfig = {
  entryPoints: ['gas_src/analyzer.ts', 'gas_src/estate.ts'],
  bundle: true,
  minify: true,
  format: 'iife', // Immediately Invoked Function Expression
  target: 'es2019',
  platform: 'neutral',
  outdir: 'gas_build',
  globalName: 'GasBundle',
  banner: {
    js: '// Google Apps Script Bundle - Auto-generated\n',
  },
  external: [], // すべての依存関係をバンドル
  define: {
    'process.env.NODE_ENV': '"production"',
  },
};

async function build() {
  try {
    console.log('🔨 Building GAS files...');
    
    // gas_buildディレクトリを作成
    if (!existsSync('gas_build')) {
      mkdirSync('gas_build', { recursive: true });
    }
    
    // ビルド実行
    const result = await esbuild.build(buildConfig);
    
    console.log('✅ Build completed!');
    
    // .jsファイルを.gsファイルに変換
    const files = ['analyzer.js', 'estate.js'];
    
    for (const file of files) {
      const jsPath = join('gas_build', file);
      const gsPath = join('gas', file.replace('.js', '.gs'));
      
      if (existsSync(jsPath)) {
        let content = readFileSync(jsPath, 'utf-8');
        
        // IIFE形式を展開してグローバルスコープに配置
        content = content.replace(/^\(function\(\)\s*\{/, '');
        content = content.replace(/\}\)\(\);?\s*$/, '');
        
        // GAS用のコメントを追加
        content = `// Auto-generated from gas_src - Do not edit manually\n${content}`;
        
        writeFileSync(gsPath, content, 'utf-8');
        console.log(`✅ Generated: ${gsPath}`);
      }
    }
    
    console.log('🎉 All files generated successfully!');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
